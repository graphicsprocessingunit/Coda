import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  getSyncedLyricsEnabledSnapshot,
  loadSyncedLyricsEnabled,
  setSyncedLyricsEnabled,
  subscribeSyncedLyricsEnabled,
} from '../src/services/LyricsSettings';

const STORAGE_KEY = '@coda_synced_lyrics_enabled';

beforeEach(async () => {
  await AsyncStorage.clear();
  await setSyncedLyricsEnabled(true);
});

describe('synced lyrics preference', () => {
  it('defaults to enabled when nothing is stored', async () => {
    await AsyncStorage.clear();
    await expect(loadSyncedLyricsEnabled()).resolves.toBe(true);
  });

  it('persists a disabled choice and reloads it', async () => {
    await setSyncedLyricsEnabled(false);

    expect(getSyncedLyricsEnabledSnapshot()).toBe(false);
    await expect(loadSyncedLyricsEnabled()).resolves.toBe(false);
    expect(await AsyncStorage.getItem(STORAGE_KEY)).toBe('false');
  });

  it('treats unexpected stored values as enabled', async () => {
    await AsyncStorage.setItem(STORAGE_KEY, 'garbage');
    await expect(loadSyncedLyricsEnabled()).resolves.toBe(true);
  });

  it('notifies subscribers and stops after unsubscribing', async () => {
    const listener = jest.fn();
    const unsubscribe = subscribeSyncedLyricsEnabled(listener);

    await setSyncedLyricsEnabled(false);
    expect(listener).toHaveBeenCalledWith(false);

    unsubscribe();
    await setSyncedLyricsEnabled(true);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('keeps working when storage throws', async () => {
    jest.spyOn(AsyncStorage, 'setItem').mockRejectedValueOnce(new Error('disk full'));

    await expect(setSyncedLyricsEnabled(false)).resolves.toBeUndefined();
    expect(getSyncedLyricsEnabledSnapshot()).toBe(false);
  });
});
