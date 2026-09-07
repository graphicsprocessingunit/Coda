import { useCallback, useEffect, useMemo, useRef } from 'react';
import { Gesture } from 'react-native-gesture-handler';
import { useSharedValue, runOnJS } from 'react-native-reanimated';
import {
  createWheelTickState,
  unwrapAngleDelta,
  clampTickThreshold,
  capTicks,
  classifyTapStart,
  MAX_TICKS_PER_SAMPLE,
  type WheelBands,
  type WheelTickState,
  type WheelZoneId,
} from './wheelMath';
import { WHEEL_CENTER_SIZE } from './ipodTheme';

const RAD_TO_DEG = 180 / Math.PI;

// The center SELECT button area is a separate physical button on the real
// wheel: touches inside it never rotate the wheel, and a tap there is SELECT.
const MIN_SELECT_RADIUS = WHEEL_CENTER_SIZE / 2;

// A touch that never emits a tick but moves more than this (or rotates more
// than this) is a drag, not a tap — fallible taps shouldn't fire buttons.
const TAP_MAX_MOVE = 24;
const TAP_MAX_ROTATION = 8;

// Matches the classic recessed-button geometry (bands near 12/3/6/9 o'clock).
const TAP_BANDS: WheelBands = { topY: 70, bottomY: 168, leftX: 84, rightX: 156 };

export interface WheelTapZones {
  onMenu: () => void;
  onPrevious: () => void;
  onNext: () => void;
  onPlayPause: () => void;
  onSelect: () => void;
}

interface UseWheelTicksOptions {
  onTicks: (ticks: number) => void;
  zones: WheelTapZones;
  onTapHaptic?: () => void;
}

/**
 * Builds the single pan gesture that turns circular finger motion into
 * discrete scroll ticks AND classifies still touches as wheel-button taps.
 * The pan is attached to a layer that covers the entire wheel surface, so a
 * drag starting anywhere — including on a button label — scrolls, exactly
 * like a real click wheel; only still taps trigger MENU/skip/play/SELECT.
 *
 * All JS callbacks are reached through a ref (never stored inside a shared
 * value — reanimated does not support functions there), so the gesture is
 * created once and memoized. An unmount guard prevents any dispatch from
 * firing into a torn-down tree.
 */
export function useWheelTicks(options: UseWheelTicksOptions): {
  onWheelLayout: (e: { nativeEvent: { layout: { width: number; height: number } } }) => void;
  wheelPan: ReturnType<typeof Gesture.Pan>;
} {
  const centerX = useSharedValue(0);
  const centerY = useSharedValue(0);
  const measured = useSharedValue(0);
  const prevDeg = useSharedValue(0);
  const acc = useSharedValue(0);
  const hasPrev = useSharedValue(false);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);
  const rotAcc = useSharedValue(0);
  const peakMove = useSharedValue(0);
  const didScroll = useSharedValue(0);

  // Latest handlers, read on the JS thread only.
  const handlersRef = useRef(options);
  useEffect(() => {
    handlersRef.current = options;
  }, [options]);

  const mountedRef = useRef(true);
  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Stable JS-side dispatchers: safe to pass to runOnJS from the worklet.
  const dispatchTicks = useCallback((ticks: number) => {
    if (!mountedRef.current) return;
    if (!Number.isFinite(ticks) || ticks === 0) return;
    handlersRef.current.onTicks(ticks);
  }, []);

  const dispatchTap = useCallback((zone: WheelZoneId) => {
    if (!mountedRef.current || zone === 'none') return;
    handlersRef.current.onTapHaptic?.();
    const z = handlersRef.current.zones;
    switch (zone) {
      case 'menu':
        z.onMenu();
        break;
      case 'previous':
        z.onPrevious();
        break;
      case 'next':
        z.onNext();
        break;
      case 'play':
        z.onPlayPause();
        break;
      case 'select':
        z.onSelect();
        break;
    }
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
        .onBegin((e) => {
          startX.value = e.x;
          startY.value = e.y;
          acc.value = 0;
          rotAcc.value = 0;
          peakMove.value = 0;
          prevDeg.value = 0;
          hasPrev.value = false;
          didScroll.value = 0;
        })
        .onUpdate((e) => {
          if (!measured.value) return;
          const dx = e.x - centerX.value;
          const dy = e.y - centerY.value;
          const radius = Math.sqrt(dx * dx + dy * dy);
          // Inside the center button there is no wheel ring: ignore rotation
          // there (and don't move prevDeg, so re-entering the ring can't jump).
          if (radius >= MIN_SELECT_RADIUS) {
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
            rotAcc.value += Math.abs(delta);
            const threshold = clampTickThreshold(Math.abs(delta));
            if (acc.value >= threshold || acc.value <= -threshold) {
              const ticks = capTicks(Math.trunc(acc.value / threshold));
              acc.value -= ticks * threshold;
              if (ticks !== 0) {
                didScroll.value = 1;
                runOnJS(dispatchTicks)(ticks);
              }
            }
          }
          // Track travel from the touch-down point regardless of radius: a
          // drag that produces no rotation (e.g. radial) is still not a tap.
          const dxs = e.x - startX.value;
          const dys = e.y - startY.value;
          const travelled = Math.sqrt(dxs * dxs + dys * dys);
          if (travelled > peakMove.value) peakMove.value = travelled;
        })
        .onFinalize(() => {
          const scrolled = didScroll.value > 0;
          const moved = peakMove.value;
          const rotated = rotAcc.value;
          // Scroll state must reset even when the gesture never activated, so
          // consecutive taps can't inherit stale angle/accumulator state.
          hasPrev.value = false;
          acc.value = 0;
          rotAcc.value = 0;
          if (scrolled || moved > TAP_MAX_MOVE || rotated >= TAP_MAX_ROTATION) return;
          runOnJS(dispatchTap)(
            classifyTapStart(startX.value, startY.value, centerX.value, centerY.value, MIN_SELECT_RADIUS, TAP_BANDS)
          );
        }),
    [dispatchTicks, dispatchTap]
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