import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { useTheme } from '../../context/ThemeContext';
import { useWheelTicks } from './useWheelTicks';
import { WHEEL_DIAMETER, WHEEL_CENTER_SIZE, contrastFor } from './ipodTheme';

interface ClickWheelProps {
  isPlaying: boolean;
  onMenu: () => void;
  onPrevious: () => void;
  onNext: () => void;
  onPlayPause: () => void;
  onSelect: () => void;
  onTicks: (ticks: number) => void;
}

function tapHaptic() {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}
function scrollHaptic() {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft).catch(() => {});
}

export function ClickWheel({
  isPlaying,
  onMenu,
  onPrevious,
  onNext,
  onPlayPause,
  onSelect,
  onTicks,
}: ClickWheelProps) {
  const { ipod } = useTheme();

  const onTick = React.useCallback(
    (ticks: number) => {
      if (ticks === 0) return;
      scrollHaptic();
      onTicks(ticks);
    },
    [onTicks]
  );

  const { onWheelLayout, wheelPan } = useWheelTicks(onTick);

  const glyph = contrastFor(ipod.wheelColor);
  const dim = contrastFor(ipod.screenBg) === '#1A1A1A' ? 'rgba(0,0,0,0.55)' : 'rgba(255,255,255,0.55)';

  const zone = (ch: () => void, label: string) => (
    <Pressable
      accessibilityLabel={label}
      onPress={() => {
        tapHaptic();
        ch();
      }}
      hitSlop={8}
    >
      <View
        style={{
          width: 44,
          height: 40,
          borderRadius: 12,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Ionicons name={label === 'menu' ? 'menu' : label} size={label === 'menu' ? 26 : 28} color={glyph} />
      </View>
    </Pressable>
  );

  return (
    <View
      style={[
        styles.wheel,
        {
          backgroundColor: ipod.wheelColor,
          borderColor: dim,
        },
      ]}
    >
      <GestureDetector gesture={wheelPan}>
        <View style={StyleSheet.absoluteFill} onLayout={onWheelLayout} />
      </GestureDetector>

      {/* Center select */}
      <Pressable
        accessibilityLabel="Select"
        onPress={() => {
          tapHaptic();
          onSelect();
        }}
        style={[styles.select, { borderColor: dim }]}
      >
        <View style={[styles.selectDot, { backgroundColor: dim }]} />
      </Pressable>

      <View style={styles.zoneTop}>{zone(onMenu, 'menu')}</View>
      <View style={styles.zoneLeft}>{zone(onPrevious, 'play-skip-back')}</View>
      <View style={styles.zoneRight}>{zone(onNext, 'play-skip-forward')}</View>
      <View style={styles.zoneBottom}>
        {zone(isPlaying ? onPlayPause : onPlayPause, isPlaying ? 'pause' : 'play')}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wheel: {
    width: WHEEL_DIAMETER,
    height: WHEEL_DIAMETER,
    borderRadius: WHEEL_DIAMETER / 2,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  select: {
    width: WHEEL_CENTER_SIZE,
    height: WHEEL_CENTER_SIZE,
    borderRadius: WHEEL_CENTER_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  selectDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 14,
  },
  zoneTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoneLeft: {
    position: 'absolute',
    left: 0,
    top: WHEEL_DIAMETER / 2 - 22,
    bottom: WHEEL_DIAMETER / 2 - 22,
    width: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoneRight: {
    position: 'absolute',
    right: 0,
    top: WHEEL_DIAMETER / 2 - 22,
    bottom: WHEEL_DIAMETER / 2 - 22,
    width: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoneBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
});