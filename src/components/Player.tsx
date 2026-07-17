import React, { useEffect, useRef, useState, useCallback } from 'react';
import { View, StyleSheet, Text, Pressable, Image, Animated, Easing } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import { useAudio } from '../context/AudioContext';
import { ProgressBar } from './ProgressBar';
import { LyricsDisplay } from './LyricsDisplay';
import { fetchLyrics } from '../services/LyricsService';

interface PlayerProps {
  currentTrack: { title: string; artist: string; uri: string; artwork?: string; album?: string } | null;
  isPlaying: boolean;
  playbackPosition: number;
  duration: number;
  onPlay: () => void;
  onPause: () => void;
  onSkipNext: () => void;
  onSkipPrevious: () => void;
  onSeek: (position: number) => void;
  shuffleEnabled?: boolean;
  repeatEnabled?: boolean;
  onToggleShuffle?: () => void;
  onToggleRepeat?: () => void;
  onEffectsPress?: () => void;
  onQueuePress?: () => void;
  onInfoPress?: () => void;
  sleepTimerRemaining?: number | null;
}

export function Player({
  currentTrack,
  isPlaying,
  playbackPosition,
  duration,
  onPlay,
  onPause,
  onSkipNext,
  onSkipPrevious,
  onSeek,
  shuffleEnabled = false,
  repeatEnabled = false,
  onToggleShuffle,
  onToggleRepeat,
  onEffectsPress,
  onQueuePress,
  onInfoPress,
  sleepTimerRemaining,
}: PlayerProps) {
  const { colors } = useTheme();

  const albumScale = useRef(new Animated.Value(0.9)).current;
  const albumOpacity = useRef(new Animated.Value(0)).current;
  const playButtonScale = useRef(new Animated.Value(1)).current;
  const skipNextScale = useRef(new Animated.Value(1)).current;
  const skipPrevScale = useRef(new Animated.Value(1)).current;

  const [lyricsVisible, setLyricsVisible] = useState(false);
  const [lyricsText, setLyricsText] = useState<string | null>(null);

  const loadLyrics = useCallback(async () => {
    if (!currentTrack) return;
    const lyrics = await fetchLyrics(
      currentTrack.artist,
      currentTrack.title,
      currentTrack.album || '',
      duration
    );
    setLyricsText(lyrics);
  }, [currentTrack?.artist, currentTrack?.title, currentTrack?.album, duration]);

  useEffect(() => {
    setLyricsText(null);
    loadLyrics();
  }, [currentTrack?.uri]);

  useEffect(() => {
    Animated.parallel([
      Animated.spring(albumScale, { toValue: 1, useNativeDriver: true, damping: 12, stiffness: 100 }),
      Animated.timing(albumOpacity, { toValue: 1, duration: 400, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
  }, [currentTrack?.uri]);

  const handlePlayPause = () => {
    Animated.sequence([
      Animated.spring(playButtonScale, { toValue: 0.85, useNativeDriver: true, damping: 10, stiffness: 300 }),
      Animated.spring(playButtonScale, { toValue: 1, useNativeDriver: true, damping: 10, stiffness: 200 }),
    ]).start();
    if (isPlaying) {
      onPause();
    } else {
      onPlay();
    }
  };

  const handleSkipNext = () => {
    Animated.sequence([
      Animated.spring(skipNextScale, { toValue: 0.8, useNativeDriver: true, damping: 10, stiffness: 300 }),
      Animated.spring(skipNextScale, { toValue: 1, useNativeDriver: true, damping: 10, stiffness: 200 }),
    ]).start();
    onSkipNext();
  };

  const handleSkipPrevious = () => {
    Animated.sequence([
      Animated.spring(skipPrevScale, { toValue: 0.8, useNativeDriver: true, damping: 10, stiffness: 300 }),
      Animated.spring(skipPrevScale, { toValue: 1, useNativeDriver: true, damping: 10, stiffness: 200 }),
    ]).start();
    onSkipPrevious();
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }, lyricsVisible && { justifyContent: 'flex-start' }]} edges={['top']}>
      {!lyricsVisible && (
        <Animated.View style={[styles.albumArtContainer, { transform: [{ scale: albumScale }], opacity: albumOpacity, backgroundColor: colors.card }]}>
          {currentTrack?.artwork ? (
            <Image
              source={{ uri: currentTrack.artwork }}
              style={styles.albumArt}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.albumArtPlaceholder}>
              <Ionicons name="musical-note" size={80} color={colors.textSecondary} />
            </View>
          )}
        </Animated.View>
      )}

      <View style={[styles.trackInfo, lyricsVisible && styles.trackInfoCompact]}>
        <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
          {currentTrack?.title || 'No Track Loaded'}
        </Text>
        <Text style={[styles.artist, { color: colors.textSecondary }]} numberOfLines={1}>
          {currentTrack?.artist || '-'}
        </Text>
      </View>

      <ProgressBar
        progress={playbackPosition}
        duration={duration}
        onSeek={onSeek}
      />

      <View style={styles.secondaryControls}>
        {onToggleShuffle && (
          <Pressable onPress={onToggleShuffle} style={styles.secondaryButton}>
            <Ionicons
              name="shuffle"
              size={24}
              color={shuffleEnabled ? colors.accent : colors.textSecondary}
            />
          </Pressable>
        )}
        {onToggleRepeat && (
          <Pressable onPress={onToggleRepeat} style={styles.secondaryButton}>
            <Ionicons
              name="repeat"
              size={24}
              color={repeatEnabled ? colors.accent : colors.textSecondary}
            />
          </Pressable>
        )}
        {onEffectsPress && (
          <Pressable onPress={onEffectsPress} style={styles.secondaryButton}>
            <Ionicons name="options" size={24} color={colors.textSecondary} />
          </Pressable>
        )}
        <Pressable
          onPress={() => setLyricsVisible(!lyricsVisible)}
          style={styles.secondaryButton}
        >
          <Ionicons
            name="document-text"
            size={24}
            color={lyricsVisible ? colors.accent : colors.textSecondary}
          />
        </Pressable>
        {onInfoPress && (
          <Pressable onPress={onInfoPress} style={styles.secondaryButton}>
            <Ionicons name="information-circle" size={24} color={colors.textSecondary} />
          </Pressable>
        )}
        {onQueuePress && (
          <Pressable onPress={onQueuePress} style={styles.secondaryButton}>
            <Ionicons name="list" size={24} color={colors.textSecondary} />
          </Pressable>
        )}
      </View>

      {sleepTimerRemaining != null && sleepTimerRemaining > 0 && (
        <View style={[styles.timerBadge, { backgroundColor: colors.accent + '20' }]}>
          <Ionicons name="moon" size={14} color={colors.accent} />
          <Text style={[styles.timerBadgeText, { color: colors.accent }]}>
            {Math.floor(sleepTimerRemaining / 60)}:{(sleepTimerRemaining % 60).toString().padStart(2, '0')}
          </Text>
        </View>
      )}

      {lyricsVisible && (
        <View style={styles.lyricsContainer}>
          {lyricsText ? (
            <LyricsDisplay
              lyrics={lyricsText}
              playbackPosition={playbackPosition}
              accentColor={colors.accent}
              textColor={colors.text}
              secondaryColor={colors.textSecondary}
            />
          ) : (
            <View style={styles.lyricsLoading}>
              <Text style={{ color: colors.textSecondary }}>Loading lyrics...</Text>
            </View>
          )}
        </View>
      )}

      <View style={styles.controls}>
        <Animated.View style={{ transform: [{ scale: skipPrevScale }] }}>
          <Pressable onPress={handleSkipPrevious} style={styles.controlButton}>
            <Ionicons name="play-skip-back" size={32} color={colors.text} />
          </Pressable>
        </Animated.View>

        <Animated.View style={[{ backgroundColor: colors.accent }, isPlaying && { backgroundColor: colors.text }, { transform: [{ scale: playButtonScale }] }, styles.playButton]}>
          <Pressable
            onPress={handlePlayPause}
            style={styles.playButtonInner}
          >
            <Ionicons
              name={isPlaying ? "pause" : "play"}
              size={36}
              color={colors.background}
            />
          </Pressable>
        </Animated.View>

        <Animated.View style={{ transform: [{ scale: skipNextScale }] }}>
          <Pressable onPress={handleSkipNext} style={styles.controlButton}>
            <Ionicons name="play-skip-forward" size={32} color={colors.text} />
          </Pressable>
        </Animated.View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  albumArtContainer: {
    width: 300,
    height: 300,
    marginBottom: 40,
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  albumArt: {
    width: '100%',
    height: '100%',
  },
  albumArtPlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  trackInfo: {
    alignItems: 'center',
    marginBottom: 24,
    paddingHorizontal: 20,
  },
  trackInfoCompact: {
    marginBottom: 8,
    marginTop: 4,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  artist: {
    fontSize: 16,
    textAlign: 'center',
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 40,
  },
  secondaryControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 40,
    marginBottom: 20,
  },
  secondaryButton: {
    padding: 12,
  },
  timerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 16,
    alignSelf: 'center',
  },
  timerBadgeText: {
    fontSize: 13,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  controlButton: {
    width: 60,
    height: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 4,
  },
  playButtonInner: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lyricsContainer: {
    flex: 1,
    marginBottom: 16,
  },
  lyricsLoading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
