import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  MAX_LYRICS_OFFSET_MS,
  clampLyricsOffset,
  formatLyricsOffset,
  loadLyricsOffset,
  saveLyricsOffset,
} from '../src/services/LyricsOffsetService';

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe('clampLyricsOffset', () => {
  it('keeps offsets inside the allowed window', () => {
    expect(clampLyricsOffset(MAX_LYRICS_OFFSET_MS + 5000)).toBe(MAX_LYRICS_OFFSET_MS);
    expect(clampLyricsOffset(-MAX_LYRICS_OFFSET_MS - 5000)).toBe(-MAX_LYRICS_OFFSET_MS);
  });

  it('rounds to whole milliseconds', () => {
    expect(clampLyricsOffset(499.6)).toBe(500);
  });

  it('treats non-finite values as no offset', () => {
    expect(clampLyricsOffset(Number.NaN)).toBe(0);
    expect(clampLyricsOffset(Infinity)).toBe(0);
  });
});

describe('formatLyricsOffset', () => {
  it('shows the direction and one decimal', () => {
    expect(formatLyricsOffset(500)).toBe('+0.5s');
    expect(formatLyricsOffset(-1500)).toBe('−1.5s');
  });
});

describe('offset persistence', () => {
  it('round-trips a saved offset per track', async () => {
    await saveLyricsOffset('file:///a.mp3', 1500);
    await saveLyricsOffset('file:///b.mp3', -500);

    await expect(loadLyricsOffset('file:///a.mp3')).resolves.toBe(1500);
    await expect(loadLyricsOffset('file:///b.mp3')).resolves.toBe(-500);
  });

  it('defaults to zero for unknown tracks', async () => {
    await expect(loadLyricsOffset('file:///missing.mp3')).resolves.toBe(0);
  });

  it('removes the stored value when reset to zero', async () => {
    await saveLyricsOffset('file:///a.mp3', 1000);
    await saveLyricsOffset('file:///a.mp3', 0);

    await expect(loadLyricsOffset('file:///a.mp3')).resolves.toBe(0);
    expect(await AsyncStorage.getItem('@coda_lyrics_offset_file:///a.mp3')).toBeNull();
  });

  it('ignores corrupted stored values', async () => {
    await AsyncStorage.setItem('@coda_lyrics_offset_file:///bad.mp3', 'not-a-number');
    await expect(loadLyricsOffset('file:///bad.mp3')).resolves.toBe(0);
  });
});
