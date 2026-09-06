export interface WheelTickState {
  prevAngle: number;
  accumulator: number;
}

export function createWheelTickState(): WheelTickState {
  return { prevAngle: 0, accumulator: 0 };
}

/** Signed angular delta in degrees between two angles, unwrapped across +/-180. */
export function unwrapAngleDelta(prev: number, curr: number): number {
  let d = curr - prev;
  if (d > 180) d -= 360;
  else if (d < -180) d += 360;
  return d;
}

export function clampTickThreshold(speed: number): number {
  return Math.min(16, Math.max(4, 13 - speed * 0.35));
}

/**
 * Advances the wheel accumulator with a new absolute angle (degrees) and
 * returns the number of discrete ticks to emit (positive = scroll down,
 * negative = scroll up). Mutates `state`.
 */
export function advanceWheelTick(state: WheelTickState, absoluteDegrees: number): number {
  const delta = unwrapAngleDelta(state.prevAngle, absoluteDegrees);
  state.prevAngle = absoluteDegrees;
  state.accumulator += delta;
  const threshold = clampTickThreshold(Math.abs(delta));
  if (state.accumulator >= threshold || state.accumulator <= -threshold) {
    const ticks = Math.trunc(state.accumulator / threshold);
    state.accumulator -= ticks * threshold;
    return ticks;
  }
  return 0;
}
