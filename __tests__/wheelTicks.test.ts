import {
  createWheelTickState,
  unwrapAngleDelta,
  clampTickThreshold,
  advanceWheelTick,
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
});
