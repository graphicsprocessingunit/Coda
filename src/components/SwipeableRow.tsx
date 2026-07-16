import React, { useRef, useState } from 'react';
import { Animated, PanResponder, StyleSheet, View, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface SwipeableRowProps {
  children: React.ReactNode;
  onDelete: () => void;
  deleteColor?: string;
}

export function SwipeableRow({ children, onDelete, deleteColor = '#FF3B30' }: SwipeableRowProps) {
  const translateX = useRef(new Animated.Value(0)).current;
  const iconOpacity = useRef(new Animated.Value(0)).current;
  const iconScale = useRef(new Animated.Value(0.5)).current;
  const bgOpacity = useRef(new Animated.Value(0)).current;
  const isOpenRef = useRef(false);
  const lastOffset = useRef(0);
  const [rowHeight, setRowHeight] = useState(0);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dx) > 10 && Math.abs(gestureState.dy) < Math.abs(gestureState.dx);
      },
      onPanResponderMove: (_, gestureState) => {
        const newValue = Math.min(0, Math.max(-100, lastOffset.current + gestureState.dx));
        translateX.setValue(newValue);

        const progress = Math.min(1, Math.abs(newValue) / 80);
        iconOpacity.setValue(progress);
        iconScale.setValue(0.5 + progress * 0.5);
        bgOpacity.setValue(progress);
      },
      onPanResponderRelease: (_, gestureState) => {
        const newValue = lastOffset.current + gestureState.dx;
        if (isOpenRef.current && Math.abs(gestureState.dx) < 10) {
          return;
        }
        if (newValue < -60) {
          Animated.parallel([
            Animated.spring(translateX, { toValue: -80, useNativeDriver: false }),
            Animated.spring(iconOpacity, { toValue: 1, useNativeDriver: false }),
            Animated.spring(iconScale, { toValue: 1, useNativeDriver: false }),
            Animated.spring(bgOpacity, { toValue: 1, useNativeDriver: false }),
          ]).start();
          lastOffset.current = -80;
          isOpenRef.current = true;
        } else {
          Animated.parallel([
            Animated.spring(translateX, { toValue: 0, useNativeDriver: false }),
            Animated.timing(iconOpacity, { toValue: 0, duration: 150, useNativeDriver: false }),
            Animated.spring(iconScale, { toValue: 0.5, useNativeDriver: false }),
            Animated.timing(bgOpacity, { toValue: 0, duration: 150, useNativeDriver: false }),
          ]).start();
          lastOffset.current = 0;
          isOpenRef.current = false;
        }
      },
    })
  ).current;

  const handleDelete = () => {
    onDelete();
  };

  const handleLayout = (e: any) => {
    setRowHeight(e.nativeEvent.layout.height);
  };

  return (
    <View style={styles.outerContainer}>
      <Animated.View
        style={[styles.deleteBackground, { backgroundColor: deleteColor, height: rowHeight || undefined, opacity: bgOpacity }]}
      >
        <Pressable style={styles.deleteButton} onPress={handleDelete}>
          <Animated.View style={{ opacity: iconOpacity, transform: [{ scale: iconScale }] }}>
            <Ionicons name="trash" size={20} color="#fff" />
          </Animated.View>
        </Pressable>
      </Animated.View>
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
  row: {
    backgroundColor: 'transparent',
  },
});
