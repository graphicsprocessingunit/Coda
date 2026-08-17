import React from 'react';
import { StyleSheet, View, Pressable } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
  clamp,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';

interface SwipeableRowProps {
  children: React.ReactNode;
  onDelete?: () => void;
  onDownload?: () => void;
  onPress?: () => void;
}

const ACTION_WIDTH = 80;
const THRESHOLD = ACTION_WIDTH * 0.5;
const VELOCITY_THRESHOLD = 700;
const SPRING_CONFIG = { damping: 20, stiffness: 240, mass: 0.6, overshootClamping: true };

export function SwipeableRow({ children, onDelete, onDownload, onPress }: SwipeableRowProps) {
  const { colors } = useTheme();

  const translateX = useSharedValue(0);
  const startX = useSharedValue(0);
  const settled = useSharedValue(false);

  const pan = Gesture.Pan()
    .activeOffsetX([-10, 10])
    .failOffsetY([-10, 10])
    .onBegin(() => {
      settled.value = false;
      startX.value = translateX.value;
    })
    .onUpdate((e) => {
      translateX.value = clamp(startX.value + e.translationX, -ACTION_WIDTH, ACTION_WIDTH);
    })
    .onEnd((e) => {
      settled.value = true;
      const end = startX.value + e.translationX;
      const vx = e.velocityX;
      if (end < 0 && onDelete) {
        const shouldOpen = end < -THRESHOLD || vx < -VELOCITY_THRESHOLD;
        translateX.value = withSpring(shouldOpen ? -ACTION_WIDTH : 0, SPRING_CONFIG);
      } else if (end > 0 && onDownload) {
        translateX.value = withSpring(0, SPRING_CONFIG);
        if (end > THRESHOLD || vx > VELOCITY_THRESHOLD) {
          runOnJS(onDownload)();
        }
      } else {
        translateX.value = withSpring(0, SPRING_CONFIG);
      }
    })
    .onFinalize(() => {
      if (!settled.value) {
        const end = translateX.value;
        translateX.value = withSpring(
          end < -THRESHOLD && onDelete ? -ACTION_WIDTH : 0,
          SPRING_CONFIG,
        );
      }
    });

  const tap = Gesture.Tap()
    .maxDistance(6)
    .maxDuration(500)
    .onEnd((_e, success) => {
      if (success && onPress) {
        runOnJS(onPress)();
      }
    });

  const gesture = Gesture.Race(pan, tap);

  const rowStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const deleteBgStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [-ACTION_WIDTH, 0], [1, 0], Extrapolation.CLAMP),
  }));

  const deleteIconStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      translateX.value,
      [-ACTION_WIDTH, -ACTION_WIDTH * 0.4, 0],
      [1, 0, 0],
      Extrapolation.CLAMP,
    ),
    transform: [
      {
        scale: interpolate(translateX.value, [-ACTION_WIDTH, 0], [1, 0.5], Extrapolation.CLAMP),
      },
    ],
  }));

  const downloadBgStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [0, ACTION_WIDTH], [0, 1], Extrapolation.CLAMP),
  }));

  const downloadIconStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      translateX.value,
      [0, ACTION_WIDTH * 0.4, ACTION_WIDTH],
      [0, 0, 1],
      Extrapolation.CLAMP,
    ),
    transform: [
      {
        scale: interpolate(translateX.value, [0, ACTION_WIDTH], [0.5, 1], Extrapolation.CLAMP),
      },
    ],
  }));

  const handleDelete = () => {
    translateX.value = withSpring(0, SPRING_CONFIG);
    onDelete?.();
  };

  const handleDownload = () => {
    translateX.value = withSpring(0, SPRING_CONFIG);
    onDownload?.();
  };

  return (
    <View style={styles.outerContainer}>
      {onDelete && (
        <Animated.View
          style={[styles.deleteBackground, { backgroundColor: colors.danger }, deleteBgStyle]}
        >
          <Pressable style={styles.actionButton} onPress={handleDelete}>
            <Animated.View style={deleteIconStyle}>
              <Ionicons name="trash" size={20} color="#fff" />
            </Animated.View>
          </Pressable>
        </Animated.View>
      )}
      {onDownload && (
        <Animated.View
          style={[styles.downloadBackground, { backgroundColor: colors.success }, downloadBgStyle]}
        >
          <Pressable style={styles.actionButton} onPress={handleDownload}>
            <Animated.View style={downloadIconStyle}>
              <Ionicons name="cloud-download" size={20} color="#fff" />
            </Animated.View>
          </Pressable>
        </Animated.View>
      )}
      <GestureDetector gesture={gesture}>
        <Animated.View style={[styles.row, rowStyle]}>{children}</Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  outerContainer: {
    position: 'relative',
  },
  deleteBackground: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: ACTION_WIDTH,
    alignItems: 'center',
    justifyContent: 'center',
  },
  downloadBackground: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: ACTION_WIDTH,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButton: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: {
    backgroundColor: 'transparent',
  },
});
