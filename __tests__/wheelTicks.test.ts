import {
  createWheelTickState,
  unwrapAngleDelta,
  clampTickThreshold,
  advanceWheelTick,
  capTicks,
  classifyTapStart,
  MAX_TICKS_PER_SAMPLE,
  type WheelBands,
} from '../src/components/ipod/wheelMath';

describe('unwrapAngleDelta', () => {
  it('returns the signed difference for small angles', () => {
    expect(unwrapAngleDelta(10, 20)).toBe(10);
    expect(unwrapAngleDelta(20, 10)).toBe(-10);
  });
  it('unwraps across the +180/-180 boundary', () => {
    expect(unwrapAngleDelta(170, -170)).toBe(20);
    expect(unwrapAngleDelta(-170, 170)).toBe(-20);
  });
  it('returns zero for identical angles', () => {
    expect(unwrapAngleDelta(45, 45)).toBe(0);
  });
  it('treats a full circle around as ~0 net', () => {
    expect(Math.abs(unwrapAngleDelta(0, 359))).toBeLessThanOrEqual(1);
  });
  it('returns zero for non-finite input', () => {
    expect(unwrapAngleDelta(NaN, 90)).toBe(0);
    expect(unwrapAngleDelta(90, NaN)).toBe(0);
    expect(unwrapAngleDelta(90, Infinity)).toBe(0);
    expect(unwrapAngleDelta(-Infinity, 90)).toBe(0);
  });
});

describe('capTicks', () => {
  it('caps at MAX_TICKS_PER_SAMPLE in both directions', () => {
    expect(capTicks(MAX_TICKS_PER_SAMPLE)).toBe(MAX_TICKS_PER_SAMPLE);
    expect(capTicks(100)).toBe(MAX_TICKS_PER_SAMPLE);
    expect(capTicks(-100)).toBe(-MAX_TICKS_PER_SAMPLE);
    expect(capTicks(0)).toBe(0);
  });
  it('neutralizes non-finite input', () => {
    expect(capTicks(NaN)).toBe(0);
    expect(capTicks(Infinity)).toBe(0);
    expect(capTicks(-Infinity)).toBe(0);
  });
});

describe('clampTickThreshold', () => {
  it('clamps between 4 and 16', () => {
    expect(clampTickThreshold(0)).toBe(13);
    expect(clampTickThreshold(100)).toBe(4);
    expect(clampTickThreshold(-100)).toBe(16);
  });
  it('decreases threshold (more sensitive) at higher speed', () => {
    const slow = clampTickThreshold(2);
    const fast = clampTickThreshold(15);
    expect(fast).toBeLessThanOrEqual(slow);
  });
});

describe('advanceWheelTick', () => {
  it('emits no ticks below threshold', () => {
    const state = createWheelTickState();
    expect(advanceWheelTick(state, 0)).toBe(0);
    expect(advanceWheelTick(state, 5)).toBe(0);
    expect(advanceWheelTick(state, 10)).toBe(0);
  });
  it('emits positive ticks for clockwise (down) rotation', () => {
    const state = createWheelTickState();
    advanceWheelTick(state, 0);
    const ticks = advanceWheelTick(state, 60);
    expect(ticks).toBeGreaterThan(0);
  });
  it('emits negative ticks for counter-clockwise (up) rotation', () => {
    const state = createWheelTickState();
    advanceWheelTick(state, 0);
    const ticks = advanceWheelTick(state, -60);
    expect(ticks).toBeLessThan(0);
  });
  it('accumulates across small increments until threshold', () => {
    const state = createWheelTickState();
    let total = 0;
    for (let i = 1; i <= 30; i++) {
      total += advanceWheelTick(state, i * 2);
    }
    expect(total).toBeGreaterThan(0);
  });
  it('emits consistent results from a fresh state', () => {
    const s1 = createWheelTickState();
    const s2 = createWheelTickState();
    advanceWheelTick(s1, 0);
    advanceWheelTick(s1, 30);
    advanceWheelTick(s2, 0);
    advanceWheelTick(s2, 30);
    expect(s1.accumulator).toBe(s2.accumulator);
  });
  it('ignores non-finite angles without corrupting state', () => {
    const state = createWheelTickState();
    advanceWheelTick(state, 0);
    advanceWheelTick(state, NaN);
    advanceWheelTick(state, Infinity);
    advanceWheelTick(state, 0);
    const ticks = advanceWheelTick(state, 60);
    expect(ticks).toBeGreaterThan(0);
  });
  it('resets a poisoned accumulator', () => {
    const state = createWheelTickState();
    state.accumulator = NaN;
    expect(advanceWheelTick(state, 30)).toBe(0);
    expect(state.accumulator).toBe(0);
  });
  it('caps runaway jumps to MAX_TICKS_PER_SAMPLE', () => {
    const clamped = createWheelTickState();
    advanceWheelTick(clamped, 0);
    const ticks = advanceWheelTick(clamped, -600);
    expect(Math.abs(ticks)).toBeLessThanOrEqual(MAX_TICKS_PER_SAMPLE);
    const spin = createWheelTickState();
    advanceWheelTick(spin, 0);
    expect(Math.abs(advanceWheelTick(spin, 10000))).toBeLessThanOrEqual(MAX_TICKS_PER_SAMPLE);
  });
});

describe('classifyTapStart', () => {
  // Wheel is 240x240, center at (120,120), center button radius 42.
  // Band geometry mirrors the recessed button layout.
  const cx = 120;
  const cy = 120;
  const sel = 42;
  const bands: WheelBands = { topY: 70, bottomY: 168, leftX: 84, rightX: 156 };

  it('routes the center button to select', () => {
    expect(classifyTapStart(cx, cy, cx, cy, sel, bands)).toBe('select');
    expect(classifyTapStart(100, 100, cx, cy, sel, bands)).toBe('select');
    expect(classifyTapStart(120, 140, cx, cy, sel, bands)).toBe('select');
  });
  it('routes the top band to MENU', () => {
    expect(classifyTapStart(cx, 40, cx, cy, sel, bands)).toBe('menu');
    expect(classifyTapStart(60, 50, cx, cy, sel, bands)).toBe('menu');
    expect(classifyTapStart(200, 60, cx, cy, sel, bands)).toBe('menu');
  });
  it('routes the bottom band to play/pause', () => {
    expect(classifyTapStart(cx, 200, cx, cy, sel, bands)).toBe('play');
    expect(classifyTapStart(200, 200, cx, cy, sel, bands)).toBe('play');
  });
  it('routes left/right strips to previous/next', () => {
    expect(classifyTapStart(40, cy, cx, cy, sel, bands)).toBe('previous');
    expect(classifyTapStart(200, cy, cx, cy, sel, bands)).toBe('next');
  });
  it('returns none for the mid gaps between the recessed buttons', () => {
    expect(classifyTapStart(150, 90, cx, cy, sel, bands)).toBe('none');
    expect(classifyTapStart(90, 150, cx, cy, sel, bands)).toBe('none');
  });
  it('does not crash on non-finite input', () => {
    expect(classifyTapStart(NaN, 50, cx, cy, sel, bands)).toBe('none');
    expect(classifyTapStart(50, Infinity, cx, cy, sel, bands)).toBe('none');
  });
});
