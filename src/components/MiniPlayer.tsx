import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Text, Pressable, Image, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../context/ThemeContext';
import { useAudio } from '../context/AudioContext';

export const MiniPlayer = React.memo(function MiniPlayer() {
  const { currentTrack, isPlaying, play, pause, skipNext, skipPrevious } = useAudio();
  const { colors } = useTheme();
  const navigation = useNavigation<any>();

  const slideY = useRef(new Animated.Value(80)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (currentTrack) {
      Animated.parallel([
        Animated.spring(slideY, { toValue: 0, useNativeDriver: true, damping: 15, stiffness: 120 }),
        Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideY, { toValue: 80, duration: 200, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start();
    }
  }, [currentTrack]);

  if (!currentTrack) return null;

  const handleTogglePlay = () => {
    if (isPlaying) {
      pause();
    } else {
      play();
    }
  };

  return (
    <Animated.View style={[styles.container, { backgroundColor: colors.card, borderTopColor: colors.border }, { opacity, transform: [{ translateY: slideY }] }]}>
      <Pressable style={styles.content} onPress={() => navigation.navigate('Player')}>
        {currentTrack.artwork ? (
          <Image source={{ uri: currentTrack.artwork }} style={styles.artwork} />
        ) : (
          <View style={[styles.artworkPlaceholder, { backgroundColor: colors.border }]}>
            <Ionicons name="musical-note" size={18} color={colors.textSecondary} />
          </View>
        )}
        <View style={styles.info}>
          <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>{currentTrack.title}</Text>
          <Text style={[styles.artist, { color: colors.textSecondary }]} numberOfLines={1}>{currentTrack.artist}</Text>
        </View>
        <Pressable style={styles.skipButton} onPress={skipPrevious} hitSlop={12}>
          <Ionicons name="play-skip-back" size={22} color={colors.textSecondary} />
        </Pressable>
        <Pressable style={styles.playButton} onPress={handleTogglePlay} hitSlop={12}>
          <Ionicons name={isPlaying ? 'pause' : 'play'} size={28} color={colors.accent} />
        </Pressable>
        <Pressable style={styles.skipButton} onPress={skipNext} hitSlop={12}>
          <Ionicons name="play-skip-forward" size={22} color={colors.textSecondary} />
        </Pressable>
      </Pressable>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  artwork: {
    width: 44,
    height: 44,
    borderRadius: 6,
    marginRight: 12,
  },
  artworkPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  info: {
    flex: 1,
    marginRight: 8,
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
  },
  artist: {
    fontSize: 13,
    marginTop: 2,
  },
  playButton: {
    padding: 6,
    marginRight: 4,
  },
  skipButton: {
    padding: 6,
  },
});
