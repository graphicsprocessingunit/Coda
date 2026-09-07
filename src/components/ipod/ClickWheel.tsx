import React, { useCallback, useMemo, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { useTheme } from '../../context/ThemeContext';
import { useWheelTicks } from './useWheelTicks';
import { WHEEL_DIAMETER, WHEEL_CENTER_SIZE } from './ipodTheme';

interface ClickWheelProps {
  isPlaying: boolean;
  onMenu: () => void;
  onPrevious: () => void;
  onNext: () => void;
  onPlayPause: () => void;
  onSelect: () => void;
  onTicks: (ticks: number) => void;
}

// One click per detent, spacing clicks at least this far apart so a fast
// spin degrades gracefully instead of hammering the vibrator.
const HAPTIC_MIN_INTERVAL_MS = 25;

function luminance(hex: string): number {
  const m = /^#?([0-9a-fA-F]{6})$/.exec(hex);
  if (!m) return 1;
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

function tapHaptic() {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}
function scrollHaptic() {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft).catch(() => {});
}

function ClickWheelInner({
  isPlaying,
  onMenu,
  onPrevious,
  onNext,
  onPlayPause,
  onSelect,
  onTicks,
}: ClickWheelProps) {
  const { ipod } = useTheme();

  const lastScrollHapticAtRef = useRef(0);
  const onTick = useCallback(
    (ticks: number) => {
      if (ticks === 0) return;
      onTicks(ticks);
      const n = Math.abs(ticks);
      const now = Date.now();
      let next = lastScrollHapticAtRef.current + HAPTIC_MIN_INTERVAL_MS;
      let fired = 0;
      while (fired < n && next <= now) {
        scrollHaptic();
        fired++;
        next += HAPTIC_MIN_INTERVAL_MS;
      }
      if (fired > 0) lastScrollHapticAtRef.current = now;
    },
    [onTicks]
  );

  const zones = useMemo(
    () => ({ onMenu, onPrevious, onNext, onPlayPause, onSelect }),
    [onMenu, onPrevious, onNext, onPlayPause, onSelect]
  );
  const { onWheelLayout, wheelPan } = useWheelTicks({ onTicks: onTick, zones, onTapHaptic: tapHaptic });

  const darkWheel = luminance(ipod.wheelColor) < 0.5;
  const sheenColor = darkWheel ? 'rgba(255,255,255,0.10)' : 'rgba(255,255,255,0.5)';
  const seamColor = withAlpha(ipod.wheelLabel, 0.18);
  const ringInset = (WHEEL_DIAMETER - 156) / 2;

  const zone = (label: string, onTap: () => void, content: React.ReactNode, style: object) => (
    <View
      accessible
      accessibilityRole="button"
      accessibilityLabel={label}
      onAccessibilityTap={onTap}
      pointerEvents="none"
      style={[styles.zone, style]}
    >
      {content}
    </View>
  );

  return (
    <View
      style={[
        styles.wheel,
        {
          backgroundColor: ipod.wheelColor,
          borderColor: ipod.faceplateEdge,
        },
      ]}
    >
      {/* Outer gloss cap to give the disc dimensionality. */}
      <View
        pointerEvents="none"
        style={[styles.sheen, { backgroundColor: sheenColor }]}
      />
      {/* Engraved ring that carries the printed labels. */}
      <View
        pointerEvents="none"
        style={[styles.ring, { top: ringInset, left: ringInset, borderColor: seamColor }]}
      />
      {/* An inset seam just outside the center button. */}
      <View
        pointerEvents="none"
        style={[
          styles.innerSeam,
          {
            top: (WHEEL_DIAMETER - WHEEL_CENTER_SIZE) / 2 + 6,
            left: (WHEEL_DIAMETER - WHEEL_CENTER_SIZE) / 2 + 6,
            borderColor: seamColor,
          },
        ]}
      />

      {zone('Menu', onMenu, <Text style={[styles.menuLabel, { color: ipod.wheelLabel }]}>MENU</Text>, styles.zoneTop)}
      {zone(
        'Previous track',
        onPrevious,
        <Ionicons name="play-skip-back" size={15} color={ipod.wheelLabel} />,
        styles.zoneLeft
      )}
      {zone(
        'Next track',
        onNext,
        <Ionicons name="play-skip-forward" size={15} color={ipod.wheelLabel} />,
        styles.zoneRight
      )}
      {zone(
        isPlaying ? 'Pause' : 'Play',
        onPlayPause,
        <View style={styles.playGlyphWrap}>
          {isPlaying ? (
            <View style={styles.pauseBars}>
              <View style={[styles.pauseBar, { backgroundColor: ipod.wheelLabel }]} />
              <View style={[styles.pauseBar, { backgroundColor: ipod.wheelLabel }]} />
            </View>
          ) : (
            <Ionicons name="play" size={15} color={ipod.wheelLabel} />
          )}
        </View>,
        styles.zoneBottom
      )}

      {/* Center SELECT button */}
      <View
        accessible
        accessibilityRole="button"
        accessibilityLabel="Select"
        onAccessibilityTap={onSelect}
        pointerEvents="none"
        style={[styles.select, { backgroundColor: ipod.centerFace, borderColor: ipod.faceplateEdge }]}
      >
        <View pointerEvents="none" style={[styles.selectSheen, { backgroundColor: sheenColor }]} />
      </View>

      {/* Dedicated wheel-scroll layer: covers the whole disc (including button
          labels) so a drag starting anywhere scrolls; still taps are routed by
          the gesture into MENU/skip/play/SELECT. */}
      <GestureDetector gesture={wheelPan}>
        <View style={StyleSheet.absoluteFill} onLayout={onWheelLayout} />
      </GestureDetector>
    </View>
  );
}

export const ClickWheel = React.memo(ClickWheelInner);

function withAlpha(hex: string, alpha: number): string {
  const m = /^#?([0-9a-fA-F]{6})$/.exec(hex);
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

const styles = StyleSheet.create({
  wheel: {
    width: WHEEL_DIAMETER,
    height: WHEEL_DIAMETER,
    borderRadius: WHEEL_DIAMETER / 2,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 7,
  },
  sheen: {
    position: 'absolute',
    top: 1,
    left: 1,
    right: 1,
    height: WHEEL_DIAMETER * 0.52,
    borderTopLeftRadius: WHEEL_DIAMETER / 2,
    borderTopRightRadius: WHEEL_DIAMETER / 2,
  },
  ring: {
    position: 'absolute',
    width: 156,
    height: 156,
    borderRadius: 78,
    borderWidth: 1,
  },
  innerSeam: {
    position: 'absolute',
    width: WHEEL_CENTER_SIZE - 12,
    height: WHEEL_CENTER_SIZE - 12,
    borderRadius: (WHEEL_CENTER_SIZE - 12) / 2,
    borderWidth: 1,
    opacity: 0.6,
  },
  zone: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoneTop: {
    top: 24,
    left: 0,
    right: 0,
    height: 40,
  },
  zoneLeft: {
    left: 24,
    top: 0,
    bottom: 0,
    width: 52,
  },
  zoneRight: {
    right: 24,
    top: 0,
    bottom: 0,
    width: 52,
  },
  zoneBottom: {
    bottom: 24,
    left: 0,
    right: 0,
    height: 40,
  },
  menuLabel: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 2.2,
  },
  playGlyphWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  pauseBars: {
    flexDirection: 'row',
  },
  pauseBar: {
    width: 4,
    height: 13,
    borderRadius: 1,
    marginHorizontal: 2,
  },
  select: {
    width: WHEEL_CENTER_SIZE,
    height: WHEEL_CENTER_SIZE,
    borderRadius: WHEEL_CENTER_SIZE / 2,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.32,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 5,
  },
  selectSheen: {
    position: 'absolute',
    top: 0,
    left: 2,
    right: 2,
    height: WHEEL_CENTER_SIZE * 0.5,
    borderTopLeftRadius: WHEEL_CENTER_SIZE / 2,
    borderTopRightRadius: WHEEL_CENTER_SIZE / 2,
  },
});