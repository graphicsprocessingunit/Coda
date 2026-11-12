import {
  normalizeHex,
  hexToRgb,
  rgbToHex,
  contrastRatio,
  contrastText,
  colorDistance,
  isVivid,
  mix,
  withAlpha,
} from '../src/utils/color';

describe('color utils', () => {
  it('normalizes 3- and 6-digit hex', () => {
    expect(normalizeHex('#abc')).toBe('#AABBCC');
    expect(normalizeHex('ff0000')).toBe('#FF0000');
    expect(normalizeHex('not-a-color')).toBeNull();
  });

  it('round-trips hex and rgb', () => {
    expect(hexToRgb('#FF0000')).toEqual({ r: 255, g: 0, b: 0 });
    expect(rgbToHex({ r: 255, g: 0, b: 0 })).toBe('#FF0000');
    expect(rgbToHex(hexToRgb('#123456')!)).toBe('#123456');
  });

  it('picks readable contrast text', () => {
    expect(contrastText('#000000')).toBe('#FFFFFF');
    expect(contrastText('#FFFFFF')).toBe('#000000');
  });

  it('computes contrast ratio symmetric and bounded', () => {
    const ratio = contrastRatio('#000000', '#FFFFFF');
    expect(ratio).toBeCloseTo(21, 0);
    expect(contrastRatio('#FFFFFF', '#000000')).toBeCloseTo(ratio, 5);
  });

  it('measures color distance', () => {
    expect(colorDistance('#000000', '#FFFFFF')).toBeGreaterThan(400);
    expect(colorDistance('#123456', '#123456')).toBe(0);
  });

  it('detects vivid colors and rejects greys', () => {
    expect(isVivid('#1DB954')).toBe(true);
    expect(isVivid('#808080')).toBe(false);
    expect(isVivid('#000000')).toBe(false);
    expect(isVivid('#FFFFFF')).toBe(false);
  });

  it('mixes colors', () => {
    expect(mix('#000000', '#FFFFFF', 0.5)).toBe('#808080');
    expect(mix('#FF0000', '#0000FF', 1)).toBe('#0000FF');
  });

  it('applies alpha', () => {
    expect(withAlpha('#FF0000', 0.5)).toBe('rgba(255, 0, 0, 0.5)');
  });
});
