import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Dimensions } from 'react-native';
import { useTheme } from '../context/ThemeContext';

interface SkeletonLoaderProps {
  variant: 'trackRow' | 'albumArt' | 'textLine' | 'playlistRow';
  count?: number;
}

const SCREEN_WIDTH = Dimensions.get('window').width;

function SkeletonShape({ width, height, borderRadius = 4 }: { width: number | `${number}%`; height: number; borderRadius?: number }) {
  const { colors } = useTheme();
  const translateX = useRef(new Animated.Value(-1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.timing(translateX, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      })
    ).start();
  }, [translateX]);

  const shimmerTranslate = translateX.interpolate({
    inputRange: [-1, 1],
    outputRange: [-SCREEN_WIDTH, SCREEN_WIDTH],
  });

  return (
    <View style={[{ width, height, borderRadius, backgroundColor: colors.card, overflow: 'hidden' }]}>
      <Animated.View
        style={[
          StyleSheet.absoluteFillObject,
          {
            transform: [{ translateX: shimmerTranslate }],
            width: '100%',
            height: '100%',
            opacity: 0.15,
          },
        ]}
      >
        <View style={{ flex: 1, backgroundColor: colors.border }} />
      </Animated.View>
    </View>
  );
}

function TrackRowSkeleton() {
  const { colors } = useTheme();
  return (
    <View style={trackRowStyles.container}>
      <SkeletonShape width={48} height={48} borderRadius={24} />
      <View style={trackRowStyles.textContainer}>
        <SkeletonShape width="70%" height={14} />
        <View style={{ height: 6 }} />
        <SkeletonShape width="45%" height={12} />
      </View>
      <SkeletonShape width={24} height={24} borderRadius={12} />
    </View>
  );
}

function PlaylistRowSkeleton() {
  return (
    <View style={trackRowStyles.container}>
      <SkeletonShape width={48} height={48} borderRadius={24} />
      <View style={trackRowStyles.textContainer}>
        <SkeletonShape width="55%" height={14} />
        <View style={{ height: 6 }} />
        <SkeletonShape width="30%" height={12} />
      </View>
    </View>
  );
}

function AlbumArtSkeleton() {
  return <SkeletonShape width={48} height={48} borderRadius={8} />;
}

function TextLineSkeleton({ width }: { width?: number | `${number}%` }) {
  return <SkeletonShape width={width || '60%'} height={14} />;
}

export function SkeletonLoader({ variant, count = 1 }: SkeletonLoaderProps) {
  const items = Array.from({ length: count }, (_, i) => i);

  return (
    <View style={skeletonStyles.container}>
      {items.map((i) => {
        switch (variant) {
          case 'trackRow':
            return <TrackRowSkeleton key={i} />;
          case 'albumArt':
            return <AlbumArtSkeleton key={i} />;
          case 'playlistRow':
            return <PlaylistRowSkeleton key={i} />;
          case 'textLine':
            return (
              <View key={i} style={{ marginBottom: 10 }}>
                <TextLineSkeleton width={i === count - 1 ? '40%' : undefined} />
              </View>
            );
          default:
            return null;
        }
      })}
    </View>
  );
}

const skeletonStyles = StyleSheet.create({
  container: {
    padding: 16,
  },
});

const trackRowStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  textContainer: {
    flex: 1,
    marginLeft: 12,
  },
});
