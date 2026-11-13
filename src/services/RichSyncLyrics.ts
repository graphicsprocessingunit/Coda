import type { LyricsQuery } from './LyricsService';

/**
 * Optional word-timed lyrics source. LRCLIB is line-level; Musixmatch RichSync
 * carries per-word offsets, which is converted to enhanced LRC so it flows
 * through the existing LyricsResult/LyricsDisplay path with no UI changes.
 *
 * Disabled unless EXPO_PUBLIC_MUSIXMATCH_API_KEY is set, because the RichSync
 * endpoints require a (paid) Musixmatch API key. Without a key the provider is
 * a no-op and LRCLIB behaves exactly as before.
 */

const API_BASE = 'https://api.musixmatch.com/ws/1.1';
const MATCH_RATIO = 0.05;
const MATCH_FLOOR_SEC = 8;

interface RichSyncWord {
  c?: string;
  o?: number;
}

interface RichSyncLine {
  ts?: number;
  te?: number;
  x?: string;
  l?: RichSyncWord[];
}

function apiKey(): string | null {
  const key = process.env.EXPO_PUBLIC_MUSIXMATCH_API_KEY;
  return typeof key === 'string' && key.trim().length > 0 ? key.trim() : null;
}

function timestampTag(milliseconds: number): string {
  // formatLrcTimestamp returns "[mm:ss.mmm]"; embedded word tags use "<mm:ss.mmm>".
  return `<${formatInner(milliseconds)}>`;
}

function formatInner(milliseconds: number): string {
  const total = Math.max(0, Math.round(milliseconds));
  const minutes = Math.floor(total / 60000);
  const seconds = Math.floor((total % 60000) / 1000);
  const millis = total % 1000;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(
    millis
  ).padStart(3, '0')}`;
}

function linePrefix(milliseconds: number): string {
  return `[${formatInner(milliseconds)}]`;
}

/**
 * Convert a Musixmatch RichSync payload (JSON: lines with `ts` in seconds and
 * word chunks with offsets `o`) into enhanced LRC with per-word tags.
 */
export function richSyncToLrc(body: string): string | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return null;
  }
  if (!Array.isArray(parsed)) return null;

  const lines: string[] = [];

  for (const entry of parsed as RichSyncLine[]) {
    if (!entry || typeof entry !== 'object') continue;
    const lineStart = Number(entry.ts);
    if (!Number.isFinite(lineStart)) continue;

    const words = Array.isArray(entry.l)
      ? entry.l.filter((word): word is RichSyncWord => !!word && typeof word.c === 'string' && word.c.length > 0)
      : [];

    let content: string;
    if (words.length > 0) {
      content = words
        .map((word) => {
          const offset = Number(word.o);
          const time = lineStart * 1000 + (Number.isFinite(offset) ? offset * 1000 : 0);
          return `${timestampTag(time)}${word.c}`;
        })
        .join(' ');
    } else if (typeof entry.x === 'string' && entry.x.trim().length > 0) {
      content = entry.x.trim();
    } else {
      continue;
    }

    lines.push(`${linePrefix(lineStart * 1000)} ${content}`);
  }

  return lines.length > 0 ? lines.join('\n') : null;
}

async function callEndpoint(
  endpoint: string,
  params: Record<string, string>,
  key: string
): Promise<any | null> {
  const search = new URLSearchParams({ ...params, apikey: key, format: 'json' });
  const res = await fetch(`${API_BASE}/${endpoint}?${search}`);
  if (!res.ok) return null;
  const json = await res.json();
  if (json?.message?.header?.status_code !== 200) return null;
  return json.message.body ?? null;
}

function durationMatches(trackLengthSec: unknown, durationMs?: number): boolean {
  if (!durationMs || durationMs <= 0) return true;
  const length = Number(trackLengthSec);
  if (!Number.isFinite(length) || length <= 0) return true;
  const gap = Math.abs(length * 1000 - durationMs);
  return gap <= Math.max(MATCH_FLOOR_SEC * 1000, durationMs * MATCH_RATIO);
}

/**
 * Look up word-level lyrics for a track. Returns enhanced LRC, or null when the
 * provider is not configured, has no match, or the match is a different edit.
 */
export async function fetchRichSyncLyrics(query: LyricsQuery): Promise<string | null> {
  const key = apiKey();
  const artist = query.artist?.trim();
  const title = query.title?.trim();
  if (!key || !artist || !title || artist === 'Unknown Artist') return null;

  try {
    const params: Record<string, string> = { q_artist: artist, q_track: title };
    const album = query.album?.trim();
    if (album) params.q_album = album;

    const matched = await callEndpoint('matcher.track.get', params, key);
    const track = matched?.track;
    if (!track?.track_id) return null;
    if (track.has_richsync !== undefined && Number(track.has_richsync) !== 1) return null;
    if (!durationMatches(track.track_length, query.durationMs)) return null;

    const rich = await callEndpoint(
      'track.richsync.get',
      { track_id: String(track.track_id) },
      key
    );
    const body = rich?.richsync?.richsync_body;
    if (typeof body !== 'string') return null;
    return richSyncToLrc(body);
  } catch {
    return null;
  }
}
