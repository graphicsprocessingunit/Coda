import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Text } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useDerivedValue,
  withSpring,
  runOnJS,
  clamp,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useTheme } from '../context/ThemeContext';

interface ProgressBarProps {
  progress: number;
  duration: number;
  onSeek: (value: number) => void;
  accentColor?: string;
}

const THUMB_SPRING = { damping: 18, stiffness: 300, mass: 0.5 };

export function ProgressBar({ progress, duration, onSeek, accentColor }: ProgressBarProps) {
  const { colors } = useTheme();
  const accent = accentColor ?? colors.accent;

  const width = useSharedValue(0);
  const posFraction = useSharedValue(0);
  const dragX = useSharedValue(0);
  const dragging = useSharedValue(0);
  const lastSecond = useSharedValue(-1);
  const thumbScale = useSharedValue(1);

  const [scrubMs, setScrubMs] = useState<number | null>(null);

  useEffect(() => {
    if (dragging.value === 1) return;
    posFraction.value = duration > 0 ? clamp(progress / duration, 0, 1) : 0;
  }, [progress, duration]);

  const displayFraction = useDerivedValue(() => {
    if (dragging.value === 1) {
      return width.value > 0 ? clamp(dragX.value / width.value, 0, 1) : 0;
    }
    return posFraction.value;
  });

  const fillStyle = useAnimatedStyle(() => ({
    width: `${displayFraction.value * 100}%`,
  }));

  const thumbStyle = useAnimatedStyle(() => ({
    left: `${displayFraction.value * 100}%`,
    transform: [{ scale: thumbScale.value }],
  }));

  const updateScrub = (ms: number) => {
    setScrubMs(ms);
  };

  const commit = (ms: number) => {
    setScrubMs(null);
    onSeek(clamp(ms, 0, duration));
  };

  const pan = Gesture.Pan()
    .activeOffsetX([-4, 4])
    .onBegin((e) => {
      dragging.value = 1;
      dragX.value = clamp(e.x, 0, width.value);
      const ms = width.value > 0 ? (dragX.value / width.value) * duration : 0;
      lastSecond.value = Math.floor(ms / 1000);
      thumbScale.value = withSpring(1.4, THUMB_SPRING);
      runOnJS(updateScrub)(ms);
    })
    .onUpdate((e) => {
      dragX.value = clamp(e.x, 0, width.value);
      const ms = width.value > 0 ? (dragX.value / width.value) * duration : 0;
      const second = Math.floor(ms / 1000);
      if (second !== lastSecond.value) {
        lastSecond.value = second;
        runOnJS(updateScrub)(ms);
      }
    })
    .onEnd((e) => {
      const x = clamp(e.x, 0, width.value);
      const ms = width.value > 0 ? (x / width.value) * duration : 0;
      runOnJS(commit)(ms);
    })
    .onFinalize(() => {
      dragging.value = 0;
      thumbScale.value = withSpring(1, THUMB_SPRING);
    });

  const tap = Gesture.Tap().onEnd((e, success) => {
    if (!success) return;
    const x = clamp(e.x, 0, width.value);
    const ms = width.value > 0 ? (x / width.value) * duration : 0;
    runOnJS(commit)(ms);
  });

  const gesture = Gesture.Exclusive(pan, tap);

  const formatTime = (ms: number) => {
    const seconds = Math.max(0, Math.floor(ms / 1000));
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const label = scrubMs ?? progress;

  return (
    <View style={styles.container}>
      <View style={styles.timeLabels}>
        <Text style={[styles.timeText, { color: colors.textSecondary }]}>{formatTime(label)}</Text>
        <Text style={[styles.timeText, { color: colors.textSecondary }]}>{formatTime(duration)}</Text>
      </View>
      <GestureDetector gesture={gesture}>
        <View
          style={styles.sliderContainer}
          onLayout={(event) => {
            width.value = event.nativeEvent.layout.width;
          }}
        >
          <View style={[styles.track, { backgroundColor: colors.border }]}>
            <Animated.View style={[styles.fill, { backgroundColor: accent }, fillStyle]} />
            <Animated.View style={[styles.thumb, { backgroundColor: accent }, thumbStyle]} />
          </View>
        </View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    paddingHorizontal: 20,
    marginBottom: 30,
  },
  timeLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  timeText: {
    fontSize: 12,
    fontWeight: '500',
    fontVariant: ['tabular-nums'],
  },
  sliderContainer: {
    width: '100%',
    height: 40,
    justifyContent: 'center',
  },
  track: {
    width: '100%',
    height: 4,
    borderRadius: 2,
    position: 'relative',
  },
  fill: {
    height: '100%',
    borderRadius: 2,
  },
  thumb: {
    position: 'absolute',
    width: 16,
    height: 16,
    borderRadius: 8,
    top: -6,
    marginLeft: -8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 3,
  },
});
