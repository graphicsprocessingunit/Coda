import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Per-track lyrics sync nudge. Some recordings are timed against a slightly
 * different intro/edit, so the user can shift the timings until they line up.
 * Stored per track URI, since the right offset is a property of the file.
 */
const OFFSET_PREFIX = '@coda_lyrics_offset_';

export const LYRICS_OFFSET_STEP_MS = 500;
export const MAX_LYRICS_OFFSET_MS = 10000;

export function clampLyricsOffset(offsetMs: number): number {
  if (!Number.isFinite(offsetMs)) return 0;
  return Math.max(-MAX_LYRICS_OFFSET_MS, Math.min(MAX_LYRICS_OFFSET_MS, Math.round(offsetMs)));
}

/** Positive offsets delay the lyrics; negative ones show them earlier. */
export async function loadLyricsOffset(trackUri: string): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(OFFSET_PREFIX + trackUri);
    if (raw === null) return 0;
    return clampLyricsOffset(Number(raw));
  } catch {
    return 0;
  }
}

export async function saveLyricsOffset(trackUri: string, offsetMs: number): Promise<void> {
  const value = clampLyricsOffset(offsetMs);
  try {
    if (value === 0) {
      await AsyncStorage.removeItem(OFFSET_PREFIX + trackUri);
    } else {
      await AsyncStorage.setItem(OFFSET_PREFIX + trackUri, String(value));
    }
  } catch {
    // A failed nudge should never break playback; the in-memory offset still applies.
  }
}

export function formatLyricsOffset(offsetMs: number): string {
  const seconds = clampLyricsOffset(offsetMs) / 1000;
  const sign = seconds > 0 ? '+' : '−';
  return `${sign}${Math.abs(seconds).toFixed(1)}s`;
}
