import { useEffect } from 'react';
import { Gesture } from 'react-native-gesture-handler';
import { useSharedValue, runOnJS } from 'react-native-reanimated';
import {
  createWheelTickState,
  unwrapAngleDelta,
  clampTickThreshold,
  type WheelTickState,
} from './wheelMath';

const RAD_TO_DEG = 180 / Math.PI;

/**
 * Builds the pan gesture that turns circular finger motion into discrete
 * scroll ticks. `onTicks` should be stable (wrapped in useCallback) so the
 * gesture captures the right callback.
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

  // Keep the latest callback reachable from the UI-thread worklet.
  const cbRef = useSharedValue(onTicks);
  useEffect(() => {
    cbRef.value = onTicks;
  }, [onTicks, cbRef]);

  const onWheelLayout = (e: { nativeEvent: { layout: { width: number; height: number }; } }) => {
    const { width, height } = e.nativeEvent.layout;
    centerX.value = width / 2;
    centerY.value = height / 2;
    measured.value = 1;
  };

  const wheelPan = Gesture.Pan()
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
      if (!hasPrev.value) {
        prevDeg.value = deg;
        hasPrev.value = true;
        return;
      }
      const delta = unwrapAngleDelta(prevDeg.value, deg);
      prevDeg.value = deg;
      acc.value += delta;
      const threshold = clampTickThreshold(Math.abs(delta));
      if (acc.value >= threshold || acc.value <= -threshold) {
        const ticks = Math.trunc(acc.value / threshold);
        acc.value -= ticks * threshold;
        if (ticks !== 0) {
          runOnJS(cbRef.value)(ticks);
        }
      }
    })
    .onFinalize(() => {
      hasPrev.value = false;
      acc.value = 0;
    });

  return { onWheelLayout, wheelPan };
}

export { createWheelTickState, unwrapAngleDelta, clampTickThreshold, WheelTickState };
