import AsyncStorage from '@react-native-async-storage/async-storage';

import { readEmbeddedLyrics } from './EmbeddedLyrics';
import { NavidromeService } from './NavidromeService';
import { fetchRichSyncLyrics } from './RichSyncLyrics';

/**
 * Lyrics cache keys include the track length, because the same song has many
 * timed edits (album, radio, live, remaster) with completely different word
 * timings. A cached match from one edit must never be reused for another.
 */
// v3 invalidates matches cached under the old, looser acceptance rules.
const CACHE_PREFIX = '@coda_lyrics_v3_';
const USER_AGENT = 'Coda Music Player v1.4.0';

/** Remember a miss for an hour so tracks without lyrics don't refetch on every play. */
export const NEGATIVE_CACHE_TTL_MS = 60 * 60 * 1000;

/**
 * Timings are only trustworthy if they were authored for a recording of the
 * same length. Linear rescaling to compensate is not used: trailing silence or
 * a different intro turns it into progressive drift, which is worse than
 * showing plain, untimed lyrics.
 */
const MATCH_RATIO = 0.05;
const MATCH_FLOOR_SEC = 8;

export interface LyricsQuery {
  artist: string;
  title: string;
  album?: string;
  /** Track length in milliseconds, when known. */
  durationMs?: number;
  /** Local copy of the file, used for sidecar/embedded lyrics when LRCLIB has nothing. */
  localUri?: string;
  /** Navidrome song id, for lyrics stored on the server with the file. */
  navidromeSongId?: string;
}

export interface LyricsResult {
  lyrics: string;
}

interface LrclibRecord {
  syncedLyrics?: string | null;
  plainLyrics?: string | null;
  duration?: number;
}

type CacheEntry =
  | { state: 'hit'; result: LyricsResult }
  | { state: 'miss' }
  | { state: 'stale' };

function cacheKey(query: LyricsQuery): string {
  const artist = query.artist.trim().toLowerCase();
  const title = query.title.trim().toLowerCase();
  const bucket =
    query.durationMs && query.durationMs > 0 ? Math.round(query.durationMs / 1000) : 'unknown';
  return `${CACHE_PREFIX}${artist}::${title}::${bucket}`;
}

function sourceDurationMs(record: LrclibRecord): number | undefined {
  return typeof record.duration === 'number' && record.duration > 0
    ? Math.round(record.duration * 1000)
    : undefined;
}

function durationGapMs(record: LrclibRecord, targetMs?: number): number {
  if (!targetMs || targetMs <= 0) return Infinity;
  const duration = sourceDurationMs(record);
  return duration ? Math.abs(duration - targetMs) : Infinity;
}

function within(targetMs: number, gapMs: number, ratio: number, floorSec: number): boolean {
  return gapMs <= Math.max(floorSec * 1000, targetMs * ratio);
}

/**
 * Choose the best record for the playing edit. Positive matches (same length
 * recording) win; a near-match is kept so it can be rescaled; plain lyrics are
 * preferred over timings from an unrelated edit.
 */
export function pickLyrics(records: LrclibRecord[], durationMs?: number): LyricsResult | null {
  const hasDuration = !!durationMs && durationMs > 0;
  const synced = records.filter(
    (record) => typeof record.syncedLyrics === 'string' && record.syncedLyrics.trim().length > 0
  );
  const ranked = [...synced].sort((a, b) => durationGapMs(a, durationMs) - durationGapMs(b, durationMs));

  for (const record of ranked) {
    const gap = durationGapMs(record, durationMs);
    if (!hasDuration || within(durationMs!, gap, MATCH_RATIO, MATCH_FLOOR_SEC)) {
      return { lyrics: record.syncedLyrics!.trim() };
    }
  }

  const plain = records
    .filter((record) => typeof record.plainLyrics === 'string' && record.plainLyrics.trim().length > 0)
    .sort((a, b) => durationGapMs(a, durationMs) - durationGapMs(b, durationMs))[0];
  if (plain) return { lyrics: plain.plainLyrics!.trim() };

  return null;
}

function readCacheEntry(raw: string): CacheEntry {
  try {
    const parsed = JSON.parse(raw) as {
      lyrics?: unknown;
      none?: unknown;
      at?: unknown;
    };

    if (parsed.none === true) {
      const at = typeof parsed.at === 'number' ? parsed.at : 0;
      return Date.now() - at < NEGATIVE_CACHE_TTL_MS ? { state: 'miss' } : { state: 'stale' };
    }

    if (typeof parsed.lyrics === 'string' && parsed.lyrics.length > 0) {
      return { state: 'hit', result: { lyrics: parsed.lyrics } };
    }
  } catch {
    // Fall through to "stale" so the entry is replaced.
  }
  return { state: 'stale' };
}

async function writeCache(key: string, value: unknown): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch {
    // A cache failure must never stop lyrics from being shown.
  }
}

async function getExactMatch(query: LyricsQuery): Promise<LrclibRecord[]> {
  const artist = query.artist?.trim();
  const title = query.title?.trim();
  if (!title || !artist || artist === 'Unknown Artist') return [];

  const params: Record<string, string> = { track_name: title, artist_name: artist };
  const album = query.album?.trim();
  if (album) params.album_name = album;
  if (query.durationMs && query.durationMs > 0) {
    params.duration = String(Math.round(query.durationMs / 1000));
  }

  const res = await fetch(`https://lrclib.net/api/get?${new URLSearchParams(params)}`, {
    headers: { 'User-Agent': USER_AGENT },
  });
  if (!res.ok) return [];
  const record = (await res.json()) as LrclibRecord;
  return record && (record.syncedLyrics || record.plainLyrics) ? [record] : [];
}

async function searchLrclib(params: Record<string, string>): Promise<LrclibRecord[]> {
  const search = new URLSearchParams(params);
  const res = await fetch(`https://lrclib.net/api/search?${search}`, {
    headers: { 'User-Agent': USER_AGENT },
  });
  if (!res.ok) return [];
  const json = (await res.json()) as LrclibRecord[];
  return Array.isArray(json) ? json : [];
}

export async function fetchLyrics(query: LyricsQuery): Promise<LyricsResult | null> {
  const title = query.title?.trim();
  if (!title) return null;

  const key = cacheKey(query);
  const cached = await AsyncStorage.getItem(key);
  if (cached !== null) {
    const entry = readCacheEntry(cached);
    if (entry.state === 'hit') return entry.result;
    if (entry.state === 'miss') return null;
    await AsyncStorage.removeItem(key);
  }

  let result: LyricsResult | null = null;
  let failed = false;

  // Lyrics stored with the file on the server belong to the exact recording, so
  // timed ones outrank LRCLIB. Plain text from the server waits until the online
  // lookup has failed, since LRCLIB may still have timings for this edit.
  const serverLyrics = query.navidromeSongId
    ? await NavidromeService.getLyricsBySongId(query.navidromeSongId)
    : null;
  if (serverLyrics?.synced) result = { lyrics: serverLyrics.lyrics };

  // An optional word-level provider outranks line-level LRCLIB when configured.
  if (!result) {
    const richSync = await fetchRichSyncLyrics(query);
    if (richSync) result = { lyrics: richSync };
  }

  try {
    if (!result) {
      // LRCLIB's exact-match endpoint is the most reliable automatic pick: it
      // requires matching artist, title, album and duration, so try it before
      // ranking looser search results ourselves.
      result = pickLyrics(await getExactMatch(query), query.durationMs);

      const artist = query.artist?.trim();
      if (!result && artist && artist !== 'Unknown Artist') {
        result = pickLyrics(
          await searchLrclib({ track_name: title, artist_name: artist }),
          query.durationMs
        );
      }
      if (!result) {
        result = pickLyrics(await searchLrclib({ track_name: title }), query.durationMs);
      }
    }
  } catch {
    failed = true;
  }

  if (!result && serverLyrics) {
    result = { lyrics: serverLyrics.lyrics };
  }

  // Offline/private files often carry their own lyrics; use them before giving up.
  if (!result && query.localUri) {
    result = await readEmbeddedLyrics(query.localUri);
  }

  if (result) {
    await writeCache(key, result);
  } else if (!failed) {
    await writeCache(key, { none: true, at: Date.now() });
  }

  return result;
}
