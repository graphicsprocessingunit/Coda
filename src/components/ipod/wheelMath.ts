export interface WheelTickState {
  prevAngle: number;
  accumulator: number;
}

/** Maximum ticks a single wheel sample may emit (prevents runaway jumps). */
export const MAX_TICKS_PER_SAMPLE = 8;

export type WheelZoneId = 'select' | 'menu' | 'play' | 'previous' | 'next' | 'none';

export interface WheelBands {
  /** y above this is the MENU band. */
  topY: number;
  /** y below this is the PLAY/PAUSE band. */
  bottomY: number;
  /** x below this is the PREVIOUS band. */
  leftX: number;
  /** x above this is the NEXT band. */
  rightX: number;
}

/**
 * Classifies a tap on the wheel (touch-down position, in the wheel view's
 * local coordinates) into the button it corresponds to, matching the classic
 * 4-quadrant layout: center = SELECT, top band = MENU, bottom band =
 * play/pause, left strip = previous, right strip = next. Corner regions
 * resolve to the horizontal bands (as the real device's recessed buttons
 * do); the four mid gaps between the strips yield 'none'.
 */
export function classifyTapStart(
  x: number,
  y: number,
  centerX: number,
  centerY: number,
  minSelectRadius: number,
  bands: WheelBands
): WheelZoneId {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return 'none';
  if (!Number.isFinite(centerX) || !Number.isFinite(centerY) || !Number.isFinite(minSelectRadius)) return 'none';
  const dx = x - centerX;
  const dy = y - centerY;
  const radius = Math.sqrt(dx * dx + dy * dy);
  if (radius < minSelectRadius) return 'select';
  if (y < bands.topY) return 'menu';
  if (y > bands.bottomY) return 'play';
  if (x < bands.leftX) return 'previous';
  if (x > bands.rightX) return 'next';
  return 'none';
}

export function createWheelTickState(): WheelTickState {
  return { prevAngle: 0, accumulator: 0 };
}

/** Signed angular delta in degrees between two angles, unwrapped across +/-180. */
export function unwrapAngleDelta(prev: number, curr: number): number {
  if (!Number.isFinite(prev) || !Number.isFinite(curr)) return 0;
  let d = curr - prev;
  if (d > 180) d -= 360;
  else if (d < -180) d += 360;
  return d;
}

export function clampTickThreshold(speed: number): number {
  if (!Number.isFinite(speed)) return 13;
  return Math.min(16, Math.max(4, 13 - speed * 0.35));
}

export function capTicks(ticks: number): number {
  if (!Number.isFinite(ticks)) return 0;
  return Math.max(-MAX_TICKS_PER_SAMPLE, Math.min(MAX_TICKS_PER_SAMPLE, ticks));
}

/**
 * Advances the wheel accumulator with a new absolute angle (degrees) and
 * returns the number of discrete ticks to emit (positive = scroll down,
 * negative = scroll up). Mutates `state`. Defensively guards against
 * non-finite input and runaway accumulators.
 */
export function advanceWheelTick(state: WheelTickState, absoluteDegrees: number): number {
  if (!Number.isFinite(absoluteDegrees) || !Number.isFinite(state.accumulator)) {
    if (Number.isFinite(absoluteDegrees)) state.prevAngle = absoluteDegrees;
    if (!Number.isFinite(state.accumulator)) state.accumulator = 0;
    return 0;
  }
  const delta = unwrapAngleDelta(state.prevAngle, absoluteDegrees);
  state.prevAngle = absoluteDegrees;
  state.accumulator += delta;
  if (!Number.isFinite(state.accumulator)) {
    state.accumulator = 0;
    return 0;
  }
  const threshold = clampTickThreshold(Math.abs(delta));
  if (state.accumulator >= threshold || state.accumulator <= -threshold) {
    const ticks = capTicks(Math.trunc(state.accumulator / threshold));
    state.accumulator -= ticks * threshold;
    return ticks;
  }
  return 0;
}