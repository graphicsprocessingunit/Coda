import React, { useRef, useState } from 'react';
import { Animated, PanResponder, StyleSheet, View, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface SwipeableRowProps {
  children: React.ReactNode;
  onDelete?: () => void;
  deleteColor?: string;
  onDownload?: () => void;
  downloadColor?: string;
}

export function SwipeableRow({ children, onDelete, deleteColor = '#FF3B30', onDownload, downloadColor = '#34C759' }: SwipeableRowProps) {
  const translateX = useRef(new Animated.Value(0)).current;
  const leftIconOpacity = useRef(new Animated.Value(0)).current;
  const leftIconScale = useRef(new Animated.Value(0.5)).current;
  const leftBgOpacity = useRef(new Animated.Value(0)).current;
  const rightIconOpacity = useRef(new Animated.Value(0)).current;
  const rightIconScale = useRef(new Animated.Value(0.5)).current;
  const rightBgOpacity = useRef(new Animated.Value(0)).current;
  const isOpenRef = useRef<'left' | 'right' | null>(null);
  const lastOffset = useRef(0);
  const [rowHeight, setRowHeight] = useState(0);

  const closeAll = (direction: 'left' | 'right' | null) => {
    if (direction === 'left') {
      Animated.parallel([
        Animated.spring(translateX, { toValue: -80, useNativeDriver: true }),
        Animated.spring(leftIconOpacity, { toValue: 1, useNativeDriver: true }),
        Animated.spring(leftIconScale, { toValue: 1, useNativeDriver: true }),
        Animated.spring(leftBgOpacity, { toValue: 1, useNativeDriver: true }),
        Animated.timing(rightIconOpacity, { toValue: 0, duration: 150, useNativeDriver: true }),
        Animated.spring(rightIconScale, { toValue: 0.5, useNativeDriver: true }),
        Animated.timing(rightBgOpacity, { toValue: 0, duration: 150, useNativeDriver: true }),
      ]).start();
    } else if (direction === 'right') {
      Animated.parallel([
        Animated.spring(translateX, { toValue: 80, useNativeDriver: true }),
        Animated.spring(rightIconOpacity, { toValue: 1, useNativeDriver: true }),
        Animated.spring(rightIconScale, { toValue: 1, useNativeDriver: true }),
        Animated.spring(rightBgOpacity, { toValue: 1, useNativeDriver: true }),
        Animated.timing(leftIconOpacity, { toValue: 0, duration: 150, useNativeDriver: true }),
        Animated.spring(leftIconScale, { toValue: 0.5, useNativeDriver: true }),
        Animated.timing(leftBgOpacity, { toValue: 0, duration: 150, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.spring(translateX, { toValue: 0, useNativeDriver: true }),
        Animated.timing(leftIconOpacity, { toValue: 0, duration: 150, useNativeDriver: true }),
        Animated.spring(leftIconScale, { toValue: 0.5, useNativeDriver: true }),
        Animated.timing(leftBgOpacity, { toValue: 0, duration: 150, useNativeDriver: true }),
        Animated.timing(rightIconOpacity, { toValue: 0, duration: 150, useNativeDriver: true }),
        Animated.spring(rightIconScale, { toValue: 0.5, useNativeDriver: true }),
        Animated.timing(rightBgOpacity, { toValue: 0, duration: 150, useNativeDriver: true }),
      ]).start();
    }
    isOpenRef.current = direction;
  };

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dx) > 10 && Math.abs(gestureState.dy) < Math.abs(gestureState.dx);
      },
      onPanResponderMove: (_, gestureState) => {
        const clampedDx = Math.max(-100, Math.min(100, lastOffset.current + gestureState.dx));
        translateX.setValue(clampedDx);

        if (clampedDx < 0 && onDelete) {
          const progress = Math.min(1, Math.abs(clampedDx) / 80);
          leftIconOpacity.setValue(progress);
          leftIconScale.setValue(0.5 + progress * 0.5);
          leftBgOpacity.setValue(progress);
          rightIconOpacity.setValue(0);
          rightBgOpacity.setValue(0);
        } else if (clampedDx > 0 && onDownload) {
          const progress = Math.min(1, clampedDx / 80);
          rightIconOpacity.setValue(progress);
          rightIconScale.setValue(0.5 + progress * 0.5);
          rightBgOpacity.setValue(progress);
          leftIconOpacity.setValue(0);
          leftBgOpacity.setValue(0);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        const newValue = lastOffset.current + gestureState.dx;

        if (isOpenRef.current && Math.abs(gestureState.dx) < 10) {
          return;
        }

        if (newValue < -60 && onDelete) {
          closeAll('left');
          lastOffset.current = -80;
        } else if (newValue > 60 && onDownload) {
          closeAll('right');
          lastOffset.current = 80;
        } else {
          closeAll(null);
          lastOffset.current = 0;
        }
      },
    })
  ).current;

  const handleDelete = () => {
    closeAll(null);
    lastOffset.current = 0;
    onDelete?.();
  };

  const handleDownload = () => {
    closeAll(null);
    lastOffset.current = 0;
    onDownload?.();
  };

  const handleLayout = (e: any) => {
    setRowHeight(e.nativeEvent.layout.height);
  };

  const hasLeft = !!onDelete;
  const hasRight = !!onDownload;

  return (
    <View style={styles.outerContainer}>
      {hasLeft && (
        <Animated.View
          style={[styles.deleteBackground, { backgroundColor: deleteColor, height: rowHeight || undefined, opacity: leftBgOpacity }]}
        >
          <Pressable style={styles.deleteButton} onPress={handleDelete}>
            <Animated.View style={{ opacity: leftIconOpacity, transform: [{ scale: leftIconScale }] }}>
              <Ionicons name="trash" size={20} color="#fff" />
            </Animated.View>
          </Pressable>
        </Animated.View>
      )}
      {hasRight && (
        <Animated.View
          style={[styles.downloadBackground, { backgroundColor: downloadColor, height: rowHeight || undefined, opacity: rightBgOpacity }]}
        >
          <Pressable style={styles.downloadButton} onPress={handleDownload}>
            <Animated.View style={{ opacity: rightIconOpacity, transform: [{ scale: rightIconScale }] }}>
              <Ionicons name="cloud-download" size={20} color="#fff" />
            </Animated.View>
          </Pressable>
        </Animated.View>
      )}
      <Animated.View
        style={[styles.row, { transform: [{ translateX }] }]}
        {...panResponder.panHandlers}
      >
        <View onLayout={handleLayout}>
          {children}
        </View>
      </Animated.View>
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
    width: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteButton: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  downloadBackground: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  downloadButton: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: {
    backgroundColor: 'transparent',
  },
});
