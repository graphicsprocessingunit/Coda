import {
  IPOD_FINISHES,
  DEFAULT_FINISH_ID,
  finishFor,
  nearestFinish,
  IPOD_SCREEN,
  WHEEL_DIAMETER,
  WHEEL_CENTER_SIZE,
  IPOD_ROW_HEIGHT,
} from '../src/components/ipod/ipodTheme';

describe('IPOD_FINISHES', () => {
  it('is a curated list of finishes', () => {
    expect(IPOD_FINISHES.length).toBeGreaterThanOrEqual(6);
  });
  it('has unique ids and labels and a default present', () => {
    const ids = new Set(IPOD_FINISHES.map((f) => f.id));
    const labels = new Set(IPOD_FINISHES.map((f) => f.label));
    expect(ids.size).toBe(IPOD_FINISHES.length);
    expect(labels.size).toBe(IPOD_FINISHES.length);
    expect(ids.has(DEFAULT_FINISH_ID)).toBe(true);
  });
  it('defines valid 6-digit hex colors on every finish', () => {
    const hex = /^#[0-9a-fA-F]{6}$/;
    for (const f of IPOD_FINISHES) {
      expect(f.faceplate).toMatch(hex);
      expect(f.faceplateEdge).toMatch(hex);
      expect(f.wheelFace).toMatch(hex);
      expect(f.wheelLabel).toMatch(hex);
      expect(f.centerFace).toMatch(hex);
    }
  });
});

describe('finishFor', () => {
  it('resolves known ids', () => {
    expect(finishFor('classic-white').id).toBe('classic-white');
    expect(finishFor('classic-black').id).toBe('classic-black');
    expect(finishFor('aluminum').id).toBe('aluminum');
  });
  it('falls back to the default for unknown or missing ids', () => {
    expect(finishFor('nope').id).toBe(DEFAULT_FINISH_ID);
    expect(finishFor(undefined).id).toBe(DEFAULT_FINISH_ID);
  });
});

describe('nearestFinish', () => {
  it('matches exact finish wheel colors', () => {
    expect(nearestFinish('#ECECEA')).toBe('classic-white');
    expect(nearestFinish('#2C2C2E')).toBe('classic-black');
    expect(nearestFinish('#BCC1C7')).toBe('aluminum');
  });
  it('collapses the shared mini wheel face to the first matching finish', () => {
    expect(nearestFinish('#EFEFED')).toBe('mini-blue');
  });
  it('falls back to the default for invalid input', () => {
    expect(nearestFinish('')).toBe(DEFAULT_FINISH_ID);
    expect(nearestFinish('#12')).toBe(DEFAULT_FINISH_ID);
    expect(nearestFinish(undefined)).toBe(DEFAULT_FINISH_ID);
  });
});

describe('screen and geometry constants', () => {
  it('keeps the fixed classic LCD palette', () => {
    expect(IPOD_SCREEN.bg).toBe('#FFFFFF');
    expect(IPOD_SCREEN.text).toBe('#101010');
    expect(IPOD_SCREEN.highlightTop).not.toBe('');
    expect(IPOD_SCREEN.highlightBottom).not.toBe('');
  });
  it('keeps physical wheel proportions sane', () => {
    expect(WHEEL_CENTER_SIZE).toBeLessThan(WHEEL_DIAMETER);
    expect(IPOD_ROW_HEIGHT).toBeGreaterThan(30);
  });
});