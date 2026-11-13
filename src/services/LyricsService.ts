import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Lyrics cache keys include the track length, because the same song has many
 * timed edits (album, radio, live, remaster) with completely different word
 * timings. A cached match from one edit must never be reused for another.
 */
const CACHE_PREFIX = '@coda_lyrics_v2_';
const USER_AGENT = 'Coda Music Player v1.4.0';

/** A same-recording match should be within this window… */
const MATCH_RATIO = 0.1;
const MATCH_FLOOR_SEC = 15;
/** …otherwise accept it only as a last resort, to be rescaled to the track length. */
const RESCUE_RATIO = 0.25;
const RESCUE_FLOOR_SEC = 30;

export interface LyricsQuery {
  artist: string;
  title: string;
  album?: string;
  /** Track length in milliseconds, when known. */
  durationMs?: number;
}

export interface LyricsResult {
  lyrics: string;
  /**
   * Length of the recording the timestamps were authored for. When it differs
   * from the playing edit, the display stretches the timings to compensate.
   */
  sourceDurationMs?: number;
}

interface LrclibRecord {
  syncedLyrics?: string | null;
  plainLyrics?: string | null;
  duration?: number;
}

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

function toResult(record: LrclibRecord, lyrics: string): LyricsResult {
  return { lyrics: lyrics.trim(), sourceDurationMs: sourceDurationMs(record) };
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
    const plausible =
      !hasDuration ||
      within(durationMs!, gap, MATCH_RATIO, MATCH_FLOOR_SEC) ||
      within(durationMs!, gap, RESCUE_RATIO, RESCUE_FLOOR_SEC);
    if (plausible) return toResult(record, record.syncedLyrics!);
  }

  const plain = records
    .filter((record) => typeof record.plainLyrics === 'string' && record.plainLyrics.trim().length > 0)
    .sort((a, b) => durationGapMs(a, durationMs) - durationGapMs(b, durationMs))[0];
  if (plain) return { lyrics: plain.plainLyrics!.trim() };

  return null;
}

function readCache(raw: string): LyricsResult | null {
  try {
    const parsed = JSON.parse(raw) as Partial<LyricsResult>;
    if (typeof parsed.lyrics !== 'string' || parsed.lyrics.length === 0) return null;
    return {
      lyrics: parsed.lyrics,
      sourceDurationMs:
        typeof parsed.sourceDurationMs === 'number' ? parsed.sourceDurationMs : undefined,
    };
  } catch {
    return null;
  }
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
    const parsed = readCache(cached);
    if (parsed) return parsed;
    await AsyncStorage.removeItem(key);
  }

  try {
    const artist = query.artist?.trim();
    let records: LrclibRecord[] = [];

    if (artist && artist !== 'Unknown Artist') {
      records = await searchLrclib({ track_name: title, artist_name: artist });
    }

    let result = pickLyrics(records, query.durationMs);
    if (!result) {
      result = pickLyrics(await searchLrclib({ track_name: title }), query.durationMs);
    }

    if (result) {
      await AsyncStorage.setItem(key, JSON.stringify(result));
    }
    return result;
  } catch {
    return null;
  }
}
