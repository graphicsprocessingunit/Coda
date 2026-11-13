import AsyncStorage from '@react-native-async-storage/async-storage';

import type { LyricOffsetEstimate } from './LyricsOnset';

/**
 * Per-track lyric timing corrections produced by onset alignment. Keyed like
 * the lyrics cache (artist/title/length bucket) so a correction learned for one
 * edit is not reused for another.
 */
const KEY_PREFIX = '@coda_lyric_offset_v1_';
const MAX_STORED_OFFSET_MS = 1500;

export interface StoredLyricOffset {
  offsetMs: number;
  confidence: number;
  at: number;
}

export function lyricOffsetKey(track: {
  artist: string;
  title: string;
  durationMs?: number;
}): string {
  const artist = track.artist.trim().toLowerCase();
  const title = track.title.trim().toLowerCase();
  const bucket =
    track.durationMs && track.durationMs > 0 ? Math.round(track.durationMs / 1000) : 'unknown';
  return `${KEY_PREFIX}${artist}::${title}::${bucket}`;
}

function parseStored(raw: string): StoredLyricOffset | null {
  try {
    const parsed = JSON.parse(raw) as Partial<StoredLyricOffset>;
    if (
      typeof parsed.offsetMs !== 'number' ||
      !Number.isFinite(parsed.offsetMs) ||
      Math.abs(parsed.offsetMs) > MAX_STORED_OFFSET_MS ||
      Math.abs(parsed.offsetMs) < 1
    ) {
      return null;
    }
    return {
      offsetMs: Math.round(parsed.offsetMs),
      confidence:
        typeof parsed.confidence === 'number' && Number.isFinite(parsed.confidence)
          ? parsed.confidence
          : 0,
      at: typeof parsed.at === 'number' ? parsed.at : 0,
    };
  } catch {
    return null;
  }
}

export async function loadLyricOffset(key: string): Promise<number | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (raw === null) return null;
    return parseStored(raw)?.offsetMs ?? null;
  } catch {
    return null;
  }
}

export async function saveLyricOffset(
  key: string,
  estimate: Pick<LyricOffsetEstimate, 'offsetMs' | 'confidence'>
): Promise<void> {
  if (
    !Number.isFinite(estimate.offsetMs) ||
    Math.abs(estimate.offsetMs) > MAX_STORED_OFFSET_MS ||
    Math.abs(estimate.offsetMs) < 1
  ) {
    return;
  }
  try {
    await AsyncStorage.setItem(
      key,
      JSON.stringify({
        offsetMs: Math.round(estimate.offsetMs),
        confidence: estimate.confidence,
        at: Date.now(),
      })
    );
  } catch {
    // Losing the cache only means recalibrating next time.
  }
}

export async function clearLyricOffset(key: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(key);
  } catch {
    // Ignore: the correction is advisory.
  }
}
