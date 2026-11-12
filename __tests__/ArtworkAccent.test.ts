import { pickAccent, ensureVisible } from '../src/services/ArtworkAccent';
import { contrastRatio, normalizeHex } from '../src/utils/color';
import type { ImageColorsResult } from 'react-native-image-colors';

describe('pickAccent', () => {
  it('prefers a vivid android vibrant color', () => {
    const result = {
      platform: 'android',
      dominant: '#222222',
      average: '#333333',
      vibrant: '#1DB954',
      darkVibrant: '#0A3D1F',
      lightVibrant: '#7BE0A0',
      darkMuted: '#123456',
      lightMuted: '#ABCDEF',
      muted: '#555555',
    } as ImageColorsResult;
    expect(pickAccent(result)).toBe('#1DB954');
  });

  it('skips dull candidates and picks the first vivid one', () => {
    const result = {
      platform: 'android',
      dominant: '#FF00AA',
      average: '#808080',
      vibrant: '#808080',
      darkVibrant: '#808080',
      lightVibrant: '#808080',
      darkMuted: '#808080',
      lightMuted: '#808080',
      muted: '#808080',
    } as ImageColorsResult;
    expect(pickAccent(result)).toBe('#FF00AA');
  });

  it('returns null when no candidate is vivid', () => {
    const result = {
      platform: 'android',
      dominant: '#000000',
      average: '#111111',
      vibrant: '#808080',
      darkVibrant: '#222222',
      lightVibrant: '#FFFFFF',
      darkMuted: '#333333',
      lightMuted: '#EEEEEE',
      muted: '#444444',
    } as ImageColorsResult;
    expect(pickAccent(result)).toBeNull();
  });

  it('handles the ios result shape', () => {
    const result = {
      platform: 'ios',
      background: '#000000',
      primary: '#E81B23',
      secondary: '#111111',
      detail: '#222222',
      quality: 'low',
    } as ImageColorsResult;
    expect(pickAccent(result)).toBe('#E81B23');
  });
});

describe('ensureVisible', () => {
  it('keeps a color that already contrasts with the background', () => {
    const accent = ensureVisible('#1DB954', '#000000', true);
    expect(accent).toBe('#1DB954');
    expect(contrastRatio(accent!, '#000000')).toBeGreaterThanOrEqual(1.7);
  });

  it('lightens a too-dark accent on a dark background', () => {
    const accent = ensureVisible('#101018', '#000000', true);
    expect(accent).not.toBeNull();
    expect(normalizeHex(accent!)).toBe(accent);
    expect(contrastRatio(accent!, '#000000')).toBeGreaterThanOrEqual(1.7);
  });

  it('darkens a too-light accent on a light background', () => {
    const accent = ensureVisible('#F0F0F0', '#FFFFFF', false);
    expect(accent).not.toBeNull();
    expect(contrastRatio(accent!, '#FFFFFF')).toBeGreaterThanOrEqual(1.7);
  });

  it('corrects an accent identical to the background', () => {
    const accent = ensureVisible('#000000', '#000000', true);
    expect(accent).not.toBeNull();
    expect(contrastRatio(accent!, '#000000')).toBeGreaterThanOrEqual(1.7);
  });
});
