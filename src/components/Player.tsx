import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Text, Pressable, Animated, Easing } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useAudio, usePlaybackPosition, type TrackMetadata } from '../context/AudioContext';
import { ProgressBar } from './ProgressBar';
import { LyricsDisplay } from './LyricsDisplay';
import { SkeletonLoader } from './SkeletonLoader';
import { EmptyState } from './EmptyState';
import { fetchLyrics, type LyricsResult } from '../services/LyricsService';
import { useReduceMotion } from '../hooks/useReduceMotion';
import { contrastText } from '../utils/color';

interface PlayerProps {
  currentTrack: TrackMetadata | null;
  isPlaying: boolean;
  onPlay: () => void;
  onPause: () => void;
  onSkipNext: () => void;
  onSkipPrevious: () => void;
  onSeek: (position: number) => void;
  shuffleEnabled?: boolean;
  repeatEnabled?: boolean;
  onToggleShuffle?: () => void;
  onToggleRepeat?: () => void;
  onMorePress?: () => void;
  onToggleFavorite?: () => void;
  isFavorite?: boolean;
  sleepTimerRemaining?: number | null;
  accentColor?: string;
}

function NowPlayingProgress({ onSeek, accentColor }: { onSeek: (position: number) => void; accentColor: string }) {
  const { playbackPosition, duration } = usePlaybackPosition();
  return <ProgressBar progress={playbackPosition} duration={duration} onSeek={onSeek} accentColor={accentColor} />;
}

function NowPlayingLyrics({
  lyrics,
  onSeek,
  accentColor,
  isPlaying,
}: {
  lyrics: string;
  onSeek: (position: number) => void;
  accentColor: string;
  isPlaying: boolean;
}) {
  const { playbackPosition } = usePlaybackPosition();
  const { colors } = useTheme();
  return (
    <LyricsDisplay
      lyrics={lyrics}
      playbackPosition={playbackPosition}
      accentColor={accentColor}
      textColor={colors.text}
      secondaryColor={colors.textSecondary}
      onSeek={onSeek}
      isPlaying={isPlaying}
    />
  );
}

export function Player({
  currentTrack,
  isPlaying,
  onPlay,
  onPause,
  onSkipNext,
  onSkipPrevious,
  onSeek,
  shuffleEnabled = false,
  repeatEnabled = false,
  onToggleShuffle,
  onToggleRepeat,
  onMorePress,
  onToggleFavorite,
  isFavorite = false,
  sleepTimerRemaining,
  accentColor,
}: PlayerProps) {
  const { colors } = useTheme();
  const { lastFmConnected } = useAudio();
  const reduceMotion = useReduceMotion();
  const accent = accentColor ?? colors.accent;
  const onAccent = contrastText(accent);

  const [containerWidth, setContainerWidth] = useState(0);
  const artSize = containerWidth > 0 ? Math.max(140, Math.min(containerWidth - 64, 360)) : 240;

  const albumScale = useRef(new Animated.Value(reduceMotion ? 1 : 0.92)).current;
  const albumOpacity = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;
  const playButtonScale = useRef(new Animated.Value(1)).current;
  const skipNextScale = useRef(new Animated.Value(1)).current;
  const skipPrevScale = useRef(new Animated.Value(1)).current;
  const heartScale = useRef(new Animated.Value(1)).current;

  const [lyricsVisible, setLyricsVisible] = useState(false);
  const [lyrics, setLyrics] = useState<LyricsResult | null>(null);
  const [lyricsStatus, setLyricsStatus] = useState<'loading' | 'ready' | 'none'>('loading');
  const lyricsUriRef = useRef<string | null>(null);
  const { duration: playerDuration } = usePlaybackPosition();
  // The live player reports milliseconds; TrackMetadata.duration is in seconds.
  const trackDurationMs =
    playerDuration > 0 ? playerDuration : (currentTrack?.duration ?? 0) * 1000;

  useEffect(() => {
    if (!currentTrack) {
      lyricsUriRef.current = null;
      setLyrics(null);
      setLyricsStatus('none');
      return;
    }

    if (lyricsUriRef.current !== currentTrack.uri) {
      lyricsUriRef.current = currentTrack.uri;
      setLyrics(null);
      setLyricsStatus('loading');
    }

    let cancelled = false;
    fetchLyrics({
      artist: currentTrack.artist,
      title: currentTrack.title,
      album: currentTrack.album,
      durationMs: trackDurationMs,
      localUri: currentTrack.cachedUri ?? currentTrack.uri,
      navidromeSongId: currentTrack.navidromeId,
    })
      .then((result) => {
        if (cancelled) return;
        setLyrics(result);
        setLyricsStatus(result ? 'ready' : 'none');
      })
      .catch(() => {
        if (!cancelled) setLyricsStatus('none');
      });

    return () => {
      cancelled = true;
    };
  }, [currentTrack, trackDurationMs]);


  useEffect(() => {
    if (reduceMotion) {
      albumScale.setValue(1);
      albumOpacity.setValue(1);
      return;
    }
    albumScale.setValue(0.92);
    albumOpacity.setValue(0);
    Animated.parallel([
      Animated.spring(albumScale, { toValue: 1, useNativeDriver: true, damping: 12, stiffness: 100 }),
      Animated.timing(albumOpacity, { toValue: 1, duration: 400, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
  }, [currentTrack?.uri, reduceMotion, albumOpacity, albumScale]);

  const pressFeedback = (value: Animated.Value, peak: number) => {
    if (reduceMotion) return;
    Animated.sequence([
      Animated.spring(value, { toValue: peak, useNativeDriver: true, damping: 10, stiffness: 300 }),
      Animated.spring(value, { toValue: 1, useNativeDriver: true, damping: 10, stiffness: 200 }),
    ]).start();
  };

  const handlePlayPause = () => {
    pressFeedback(playButtonScale, 0.85);
    if (isPlaying) {
      onPause();
    } else {
      onPlay();
    }
  };

  const handleSkipNext = () => {
    pressFeedback(skipNextScale, 0.8);
    onSkipNext();
  };

  const handleSkipPrevious = () => {
    pressFeedback(skipPrevScale, 0.8);
    onSkipPrevious();
  };

  const handleToggleFavorite = () => {
    pressFeedback(heartScale, 1.3);
    onToggleFavorite?.();
  };

  return (
    <View
      style={[styles.container, lyricsVisible && styles.containerLyrics]}
      onLayout={(event) => setContainerWidth(event.nativeEvent.layout.width)}
    >
      {!lyricsVisible && (
        <Animated.View
          style={[
            styles.albumArtContainer,
            {
              width: artSize,
              height: artSize,
              transform: [{ scale: albumScale }],
              opacity: albumOpacity,
              backgroundColor: colors.surface,
            },
          ]}
        >
          {currentTrack?.artwork ? (
            <Image
              source={{ uri: currentTrack.artwork }}
              style={styles.albumArt}
              contentFit="cover"
              cachePolicy="memory-disk"
              transition={reduceMotion ? 0 : 300}
              accessible={false}
            />
          ) : (
            <View style={styles.albumArtPlaceholder}>
              <Ionicons name="musical-note" size={80} color={colors.textSecondary} />
            </View>
          )}
        </Animated.View>
      )}

      <View
        style={[styles.trackInfo, lyricsVisible && styles.trackInfoCompact]}
        accessible
        accessibilityLabel={
          currentTrack
            ? [currentTrack.title, currentTrack.artist, currentTrack.album].filter(Boolean).join(', ')
            : 'No track loaded'
        }
      >
        <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
          {currentTrack?.title || 'No Track Loaded'}
        </Text>
        <Text style={[styles.artist, { color: colors.textSecondary }]} numberOfLines={1}>
          {currentTrack?.artist || '-'}
        </Text>
        {!lyricsVisible && currentTrack?.album ? (
          <Text style={[styles.album, { color: colors.textSecondary }]} numberOfLines={1}>
            {currentTrack.album}
          </Text>
        ) : null}
        {lastFmConnected && currentTrack && (
          <View style={styles.scrobbleIndicator}>
            <View style={[styles.scrobbleDot, { backgroundColor: colors.danger }]} />
            <Text style={[styles.scrobbleText, { color: colors.textSecondary }]}>Scrobbling</Text>
          </View>
        )}
      </View>

      <NowPlayingProgress onSeek={onSeek} accentColor={accent} />

      <View style={styles.secondaryControls}>
        {onToggleShuffle && (
          <Pressable
            onPress={onToggleShuffle}
            style={styles.secondaryButton}
            accessibilityRole="button"
            accessibilityLabel="Shuffle"
            accessibilityState={{ selected: shuffleEnabled }}
          >
            <Ionicons name="shuffle" size={24} color={shuffleEnabled ? accent : colors.textSecondary} />
          </Pressable>
        )}
        {onToggleRepeat && (
          <Pressable
            onPress={onToggleRepeat}
            style={styles.secondaryButton}
            accessibilityRole="button"
            accessibilityLabel="Repeat"
            accessibilityState={{ selected: repeatEnabled }}
          >
            <Ionicons name="repeat" size={24} color={repeatEnabled ? accent : colors.textSecondary} />
          </Pressable>
        )}
        <Pressable
          onPress={() => setLyricsVisible(!lyricsVisible)}
          style={styles.secondaryButton}
          accessibilityRole="button"
          accessibilityLabel="Lyrics"
          accessibilityState={{ selected: lyricsVisible }}
        >
          <Ionicons
            name="document-text"
            size={24}
            color={lyricsVisible ? accent : colors.textSecondary}
          />
        </Pressable>
        {onToggleFavorite && (
          <Pressable
            onPress={handleToggleFavorite}
            style={styles.secondaryButton}
            accessibilityRole="button"
            accessibilityLabel={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
            accessibilityState={{ selected: isFavorite }}
          >
            <Animated.View style={{ transform: [{ scale: heartScale }] }}>
              <Ionicons name="heart" size={30} color={isFavorite ? colors.danger : colors.textSecondary} />
            </Animated.View>
          </Pressable>
        )}
        {onMorePress && (
          <Pressable
            onPress={onMorePress}
            style={styles.secondaryButton}
            accessibilityRole="button"
            accessibilityLabel="More options"
          >
            <Ionicons name="ellipsis-horizontal" size={24} color={colors.textSecondary} />
          </Pressable>
        )}
      </View>

      {sleepTimerRemaining != null && sleepTimerRemaining > 0 && (
        <View
          style={[styles.timerBadge, { backgroundColor: accent + '20' }]}
          accessible
          accessibilityLabel={`Sleep timer, ${Math.ceil(sleepTimerRemaining / 60)} minutes remaining`}
        >
          <Ionicons name="moon" size={14} color={accent} />
          <Text style={[styles.timerBadgeText, { color: accent }]}>
            {Math.floor(sleepTimerRemaining / 60)}:{(sleepTimerRemaining % 60).toString().padStart(2, '0')}
          </Text>
        </View>
      )}

      {lyricsVisible && (
        <View style={styles.lyricsContainer}>
          {lyricsStatus === 'ready' && lyrics ? (
            <NowPlayingLyrics
              lyrics={lyrics.lyrics}
              onSeek={onSeek}
              accentColor={accent}
              isPlaying={isPlaying}
            />
          ) : lyricsStatus === 'none' ? (
            <EmptyState
              icon="mic-outline"
              decorativeIcons={[
                { name: 'close-circle-outline', offset: { x: 20, y: -18 }, size: 16, delay: 400 },
              ]}
              title="No lyrics found"
              subtitle="Try another track"
            />
          ) : (
            <SkeletonLoader variant="textLine" count={6} />
          )}
        </View>
      )}

      <View style={styles.controls}>
        <Animated.View style={{ transform: [{ scale: skipPrevScale }] }}>
          <Pressable
            onPress={handleSkipPrevious}
            style={styles.controlButton}
            accessibilityRole="button"
            accessibilityLabel="Previous track"
          >
            <Ionicons name="play-skip-back" size={32} color={colors.text} />
          </Pressable>
        </Animated.View>

        <Animated.View
          style={[styles.playButton, { backgroundColor: accent, transform: [{ scale: playButtonScale }] }]}
        >
          <Pressable
            onPress={handlePlayPause}
            style={styles.playButtonInner}
            accessibilityRole="button"
            accessibilityLabel={isPlaying ? 'Pause' : 'Play'}
          >
            <Ionicons name={isPlaying ? 'pause' : 'play'} size={36} color={onAccent} />
          </Pressable>
        </Animated.View>

        <Animated.View style={{ transform: [{ scale: skipNextScale }] }}>
          <Pressable
            onPress={handleSkipNext}
            style={styles.controlButton}
            accessibilityRole="button"
            accessibilityLabel="Next track"
          >
            <Ionicons name="play-skip-forward" size={32} color={colors.text} />
          </Pressable>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  containerLyrics: {
    justifyContent: 'flex-start',
  },
  albumArtContainer: {
    marginBottom: 36,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 10,
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
    marginBottom: 20,
    paddingHorizontal: 20,
    width: '100%',
  },
  trackInfoCompact: {
    marginBottom: 8,
    marginTop: 4,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 6,
    textAlign: 'center',
  },
  artist: {
    fontSize: 16,
    textAlign: 'center',
  },
  album: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: 4,
    opacity: 0.8,
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
    width: '100%',
  },
  scrobbleIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
  },
  scrobbleDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  scrobbleText: {
    fontSize: 11,
  },
});
