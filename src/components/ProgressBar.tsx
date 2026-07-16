import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Text, Pressable, Animated, Easing } from 'react-native';
import { useTheme } from '../context/ThemeContext';

interface ProgressBarProps {
  progress: number;
  duration: number;
  onSeek: (value: number) => void;
}

export function ProgressBar({ progress, duration, onSeek }: ProgressBarProps) {
  const { colors } = useTheme();
  const sliderWidthRef = useRef(0);

  const thumbPosition = useRef(new Animated.Value(0)).current;
  const thumbScale = useRef(new Animated.Value(1)).current;
  const fillWidth = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const percent = duration > 0 ? Math.min((progress / duration) * 100, 100) : 0;
    Animated.parallel([
      Animated.timing(fillWidth, { toValue: percent, duration: 300, easing: Easing.linear, useNativeDriver: false }),
      Animated.timing(thumbPosition, { toValue: percent, duration: 300, easing: Easing.linear, useNativeDriver: false }),
    ]).start();
  }, [progress, duration]);

  const formatTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const handleSeek = (event: any) => {
    const { locationX } = event.nativeEvent;
    const width = sliderWidthRef.current;
    if (width > 0 && duration > 0) {
      const seekPosition = (locationX / width) * duration;
      onSeek(Math.max(0, Math.min(seekPosition, duration)));
    }
  };

  const handlePressIn = () => {
    Animated.spring(thumbScale, { toValue: 1.5, useNativeDriver: true, damping: 10, stiffness: 300 }).start();
  };

  const handlePressOut = () => {
    Animated.spring(thumbScale, { toValue: 1, useNativeDriver: true, damping: 10, stiffness: 200 }).start();
  };

  const handleLayout = (event: any) => {
    sliderWidthRef.current = event.nativeEvent.layout.width;
  };

  const fillWidthStyle = fillWidth.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
  });

  const thumbPositionStyle = thumbPosition.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
  });

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
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
      >
        <View style={[styles.track, { backgroundColor: colors.border }]}>
          <Animated.View style={[styles.fill, { width: fillWidthStyle, backgroundColor: colors.accent }]} />
          <Animated.View
            style={[
              styles.thumb,
              { left: thumbPositionStyle, backgroundColor: colors.accent },
              { transform: [{ scale: thumbScale }] },
            ]}
          />
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
