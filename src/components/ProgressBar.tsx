import React, { useRef } from 'react';
import { View, StyleSheet, Text, Pressable } from 'react-native';
import { useTheme } from '../context/ThemeContext';

interface ProgressBarProps {
  progress: number;
  duration: number;
  onSeek: (value: number) => void;
}

export function ProgressBar({ progress, duration, onSeek }: ProgressBarProps) {
  const { colors } = useTheme();
  const sliderWidthRef = useRef(0);

  const formatTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const progressPercent = duration > 0 ? (progress / duration) * 100 : 0;

  const handleSeek = (event: any) => {
    const { locationX } = event.nativeEvent;
    const width = sliderWidthRef.current;
    if (width > 0 && duration > 0) {
      const seekPosition = (locationX / width) * duration;
      onSeek(Math.max(0, Math.min(seekPosition, duration)));
    }
  };

  const handleLayout = (event: any) => {
    sliderWidthRef.current = event.nativeEvent.layout.width;
  };

  return (
    <View style={styles.container}>
      <View style={styles.timeLabels}>
        <Text style={[styles.timeText, { color: colors.textSecondary }]}>{formatTime(progress)}</Text>
        <Text style={[styles.timeText, { color: colors.textSecondary }]}>{formatTime(duration)}</Text>
      </View>
      <Pressable
        style={styles.sliderContainer}
        onLayout={handleLayout}
        onPress={handleSeek}
      >
        <View style={[styles.track, { backgroundColor: colors.border }]}>
          <View style={[styles.fill, { width: `${progressPercent}%`, backgroundColor: colors.accent }]} />
          <View style={[styles.thumb, { left: `${progressPercent}%`, backgroundColor: colors.accent }]} />
        </View>
      </Pressable>
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
