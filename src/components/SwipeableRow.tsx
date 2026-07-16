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
      },
      onPanResponderRelease: (_, gestureState) => {
        const newValue = lastOffset.current + gestureState.dx;
        if (isOpenRef.current && Math.abs(gestureState.dx) < 10) {
          return;
        }
        if (newValue < -60) {
          Animated.spring(translateX, {
            toValue: -80,
            useNativeDriver: false,
          }).start();
          lastOffset.current = -80;
          isOpenRef.current = true;
        } else {
          Animated.spring(translateX, {
            toValue: 0,
            useNativeDriver: false,
          }).start();
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
      <View style={[styles.deleteBackground, { backgroundColor: deleteColor, height: rowHeight || undefined }]}>
        <Pressable style={styles.deleteButton} onPress={handleDelete}>
          <Ionicons name="trash" size={20} color="#fff" />
        </Pressable>
      </View>
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
