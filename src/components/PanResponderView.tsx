import React, { useRef } from 'react';
import { View, PanResponder } from 'react-native';

interface PanResponderViewProps {
  index: number;
  itemCount: number;
  itemHeight?: number;
  onDragStart: () => void;
  onDragMove: (overIndex: number) => void;
  onDragEnd: (fromIndex: number, toIndex: number) => void;
  onDragCancel: () => void;
  children: React.ReactNode;
}

export const PanResponderView = React.memo(function PanResponderView({
  index,
  itemCount,
  itemHeight = 68,
  onDragStart,
  onDragMove,
  onDragEnd,
  onDragCancel,
  children,
}: PanResponderViewProps) {
  const indexRef = useRef(index);
  const itemCountRef = useRef(itemCount);
  const itemHeightRef = useRef(itemHeight);
  const onDragStartRef = useRef(onDragStart);
  const onDragMoveRef = useRef(onDragMove);
  const onDragEndRef = useRef(onDragEnd);
  const onDragCancelRef = useRef(onDragCancel);
  const currentOffset = useRef(0);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dragActive = useRef(false);
  const grantXY = useRef({ x: 0, y: 0 });

  indexRef.current = index;
  itemCountRef.current = itemCount;
  itemHeightRef.current = itemHeight;
  onDragStartRef.current = onDragStart;
  onDragMoveRef.current = onDragMove;
  onDragEndRef.current = onDragEnd;
  onDragCancelRef.current = onDragCancel;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => false,
      onPanResponderTerminationRequest: () => !dragActive.current,
      onPanResponderGrant: (_, gestureState) => {
        dragActive.current = false;
        currentOffset.current = 0;
        grantXY.current = { x: gestureState.x0, y: gestureState.y0 };
        longPressTimer.current = setTimeout(() => {
          dragActive.current = true;
          onDragStartRef.current();
        }, 400);
      },
      onPanResponderMove: (_, gestureState) => {
        if (!dragActive.current) {
          const dx = Math.abs(gestureState.moveX - grantXY.current.x);
          const dy = Math.abs(gestureState.moveY - grantXY.current.y);
          if (dx > 10 || dy > 10) {
            if (longPressTimer.current) {
              clearTimeout(longPressTimer.current);
              longPressTimer.current = null;
            }
          }
          return;
        }
        const newOffset = gestureState.dy;
        currentOffset.current = newOffset;
        const rawIndex = indexRef.current + Math.round(newOffset / itemHeightRef.current);
        const clampedIndex = Math.max(0, Math.min(itemCountRef.current - 1, rawIndex));
        onDragMoveRef.current(clampedIndex);
      },
      onPanResponderRelease: () => {
        if (longPressTimer.current) {
          clearTimeout(longPressTimer.current);
          longPressTimer.current = null;
        }
        if (dragActive.current) {
          const finalIndex = indexRef.current + Math.round(currentOffset.current / itemHeightRef.current);
          const clampedIndex = Math.max(0, Math.min(itemCountRef.current - 1, finalIndex));
          onDragEndRef.current(indexRef.current, clampedIndex);
          dragActive.current = false;
        }
      },
      onPanResponderTerminate: () => {
        if (longPressTimer.current) {
          clearTimeout(longPressTimer.current);
          longPressTimer.current = null;
        }
        dragActive.current = false;
        onDragCancelRef.current();
      },
    })
  ).current;

  return (
    <View {...panResponder.panHandlers} style={styles.gripHandle}>
      {children}
    </View>
  );
});

const styles = {
  gripHandle: {
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    padding: 8,
  },
};
