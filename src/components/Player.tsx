import React from 'react';
import { View, StyleSheet, Text, Pressable, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import { ProgressBar } from './ProgressBar';

interface PlayerProps {
  currentTrack: { title: string; artist: string; uri: string; artwork?: string } | null;
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
}: PlayerProps) {
  const { colors } = useTheme();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={styles.albumArtContainer}>
        <Image
          source={{
            uri: currentTrack?.artwork || 'https://via.placeholder.com/400x400/1a1a1a/ffffff?text=No+Album+Art',
          }}
          style={styles.albumArt}
          resizeMode="cover"
        />
      </View>

      <View style={styles.trackInfo}>
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
      </View>

      <View style={styles.controls}>
        <Pressable onPress={onSkipPrevious} style={styles.controlButton}>
          <Ionicons name="play-skip-back" size={32} color={colors.text} />
        </Pressable>

        <Pressable
          onPress={isPlaying ? onPause : onPlay}
          style={[styles.playButton, { backgroundColor: colors.accent }, isPlaying && { backgroundColor: colors.text }]}
        >
          <Ionicons
            name={isPlaying ? "pause" : "play"}
            size={36}
            color={isPlaying ? colors.background : colors.background}
          />
        </Pressable>

        <Pressable onPress={onSkipNext} style={styles.controlButton}>
          <Ionicons name="play-skip-forward" size={32} color={colors.text} />
        </Pressable>
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
  trackInfo: {
    alignItems: 'center',
    marginBottom: 30,
    width: '100%',
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
});
