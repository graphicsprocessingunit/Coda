import { useCallback, useEffect, useMemo, useRef } from 'react';
import { Gesture } from 'react-native-gesture-handler';
import { useSharedValue, runOnJS } from 'react-native-reanimated';
import {
  createWheelTickState,
  unwrapAngleDelta,
  clampTickThreshold,
  capTicks,
  MAX_TICKS_PER_SAMPLE,
  type WheelTickState,
} from './wheelMath';

const RAD_TO_DEG = 180 / Math.PI;

/**
 * Builds the pan gesture that turns circular finger motion into discrete
 * scroll ticks. The latest `onTicks` is reached through a ref (never stored
 * inside a shared value — reanimated does not support functions there), so
 * the gesture itself is created once and memoized. An unmount guard prevents
 * tick dispatches from firing into a torn-down tree.
 */
export function useWheelTicks(onTicks: (ticks: number) => void): {
  onWheelLayout: (e: { nativeEvent: { layout: { width: number; height: number } } }) => void;
  wheelPan: ReturnType<typeof Gesture.Pan>;
} {
  const centerX = useSharedValue(0);
  const centerY = useSharedValue(0);
  const measured = useSharedValue(0);
  const prevDeg = useSharedValue(0);
  const acc = useSharedValue(0);
  const hasPrev = useSharedValue(false);

  // Latest callback, read on the JS thread only.
  const ticksRef = useRef(onTicks);
  useEffect(() => {
    ticksRef.current = onTicks;
  }, [onTicks]);

  const mountedRef = useRef(true);
  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Stable JS-side dispatcher: safe to pass to runOnJS from the worklet.
  const dispatch = useCallback((ticks: number) => {
    if (!mountedRef.current) return;
    if (!Number.isFinite(ticks) || ticks === 0) return;
    ticksRef.current?.(ticks);
  }, []);

  const onWheelLayout = useCallback((e: { nativeEvent: { layout: { width: number; height: number } } }) => {
    const { width, height } = e.nativeEvent.layout;
    centerX.value = width / 2;
    centerY.value = height / 2;
    measured.value = 1;
  }, []);

  const wheelPan = useMemo(
    () =>
      Gesture.Pan()
        .minDistance(4)
        .maxPointers(1)
        .onBegin(() => {
          acc.value = 0;
          hasPrev.value = false;
        })
        .onUpdate((e) => {
          if (!measured.value) return;
          const dx = e.x - centerX.value;
          const dy = e.y - centerY.value;
          if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
          const deg = Math.atan2(dy, dx) * RAD_TO_DEG;
          if (!Number.isFinite(deg)) return;
          if (!hasPrev.value) {
            prevDeg.value = deg;
            hasPrev.value = true;
            return;
          }
          const prev = prevDeg.value;
          if (!Number.isFinite(prev)) {
            prevDeg.value = deg;
            return;
          }
          const delta = unwrapAngleDelta(prev, deg);
          prevDeg.value = deg;
          if (!Number.isFinite(acc.value)) acc.value = 0;
          acc.value += delta;
          if (!Number.isFinite(acc.value)) {
            acc.value = 0;
            return;
          }
          const threshold = clampTickThreshold(Math.abs(delta));
          if (acc.value >= threshold || acc.value <= -threshold) {
            const ticks = capTicks(Math.trunc(acc.value / threshold));
            acc.value -= ticks * threshold;
            if (ticks !== 0) {
              runOnJS(dispatch)(ticks);
            }
          }
        })
        .onFinalize(() => {
          hasPrev.value = false;
          acc.value = 0;
        }),
    [dispatch]
  );

  return { onWheelLayout, wheelPan };
}

export {
  createWheelTickState,
  unwrapAngleDelta,
  clampTickThreshold,
  capTicks,
  MAX_TICKS_PER_SAMPLE,
  WheelTickState,
};