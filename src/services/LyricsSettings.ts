import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Display preference for lyrics. When off, timed lyrics are shown as plain
 * text instead of being highlighted against playback, for tracks where the
 * sync is wrong or distracting.
 */
const STORAGE_KEY = '@coda_synced_lyrics_enabled';

let cached = true;
const listeners = new Set<(enabled: boolean) => void>();

export function getSyncedLyricsEnabledSnapshot(): boolean {
  return cached;
}

export async function loadSyncedLyricsEnabled(): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    cached = raw === null ? true : raw !== 'false';
  } catch {
    // Keep the in-memory value if storage is unavailable.
  }
  return cached;
}

export async function setSyncedLyricsEnabled(enabled: boolean): Promise<void> {
  cached = enabled;
  listeners.forEach((listener) => listener(enabled));
  try {
    await AsyncStorage.setItem(STORAGE_KEY, enabled ? 'true' : 'false');
  } catch {
    // The preference still applies for this session.
  }
}

export function subscribeSyncedLyricsEnabled(
  listener: (enabled: boolean) => void
): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
