import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  clearLyricOffset,
  loadLyricOffset,
  lyricOffsetKey,
  saveLyricOffset,
} from '../src/services/LyricsAlignment';

const TRACK = { artist: '  Radiohead ', title: 'Weird Fishes', durationMs: 221500 };

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe('lyricOffsetKey', () => {
  it('normalizes case, whitespace and the duration bucket', () => {
    expect(lyricOffsetKey(TRACK)).toBe('@coda_lyric_offset_v1_radiohead::weird fishes::222');
  });

  it('uses an unknown bucket when duration is missing', () => {
    expect(lyricOffsetKey({ artist: 'A', title: 'B' })).toBe(
      '@coda_lyric_offset_v1_a::b::unknown'
    );
    expect(lyricOffsetKey({ artist: 'A', title: 'B', durationMs: 0 })).toBe(
      '@coda_lyric_offset_v1_a::b::unknown'
    );
  });

  it('is stable across small duration differences within the same second', () => {
    const a = lyricOffsetKey({ ...TRACK, durationMs: 221501 });
    const b = lyricOffsetKey({ ...TRACK, durationMs: 221900 });
    expect(a).toBe(b);
  });
});

describe('lyric offset cache', () => {
  it('round-trips a saved offset', async () => {
    const key = lyricOffsetKey(TRACK);
    await saveLyricOffset(key, { offsetMs: 420, confidence: 0.85 });

    await expect(loadLyricOffset(key)).resolves.toBe(420);
  });

  it('rounds fractional offsets', async () => {
    const key = lyricOffsetKey(TRACK);
    await saveLyricOffset(key, { offsetMs: 419.6, confidence: 0.9 });
    await expect(loadLyricOffset(key)).resolves.toBe(420);
  });

  it('returns null for an uncached track', async () => {
    await expect(loadLyricOffset(lyricOffsetKey(TRACK))).resolves.toBeNull();
  });

  it('rejects invalid JSON and out-of-range offsets', async () => {
    const key = lyricOffsetKey(TRACK);

    await AsyncStorage.setItem(key, 'not json');
    await expect(loadLyricOffset(key)).resolves.toBeNull();

    await AsyncStorage.setItem(key, JSON.stringify({ offsetMs: 5000, confidence: 1 }));
    await expect(loadLyricOffset(key)).resolves.toBeNull();

    await AsyncStorage.setItem(key, JSON.stringify({ offsetMs: 0, confidence: 1 }));
    await expect(loadLyricOffset(key)).resolves.toBeNull();
  });

  it('does not write invalid offsets', async () => {
    const key = lyricOffsetKey(TRACK);
    await saveLyricOffset(key, { offsetMs: 4000, confidence: 1 });
    await saveLyricOffset(key, { offsetMs: Number.NaN, confidence: 1 });

    expect(await AsyncStorage.getItem(key)).toBeNull();
  });

  it('clears a stored offset', async () => {
    const key = lyricOffsetKey(TRACK);
    await saveLyricOffset(key, { offsetMs: -250, confidence: 0.7 });
    await clearLyricOffset(key);

    await expect(loadLyricOffset(key)).resolves.toBeNull();
  });
});
