import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View, Pressable } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '../../context/ThemeContext';
import { useAudio, useIsPlaying, usePlaybackPosition } from '../../context/AudioContext';
import { fetchLyrics } from '../../services/LyricsService';
import { LyricsDisplay } from '../LyricsDisplay';
import { fmtDuration } from './menus';

interface IpodNowPlayingProps {
  volumeMode: boolean;
  lyricsOpen: boolean;
  onToggleVolume: () => void;
  onToggleLyrics: () => void;
}

export function IpodNowPlaying({
  volumeMode,
  lyricsOpen,
  onToggleVolume,
  onToggleLyrics,
}: IpodNowPlayingProps) {
  const { colors, ipod } = useTheme();
  const { currentTrack, volume, setVolume, seekTo } = useAudio();
  const { isPlaying } = useIsPlaying();
  const { playbackPosition, duration } = usePlaybackPosition();

  const [lyrics, setLyrics] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!lyricsOpen || !currentTrack) {
      setLyrics(null);
      return;
    }
    setLyrics(null);
    fetchLyrics(
      currentTrack.title,
      currentTrack.artist,
      currentTrack.album ?? '',
      (currentTrack.duration ?? 0) * 1000
    )
      .then((result) => {
        if (!cancelled) setLyrics(result);
      })
      .catch(() => {
        if (!cancelled) setLyrics(null);
      });
    return () => {
      cancelled = true;
    };
  }, [lyricsOpen, currentTrack]);

  if (!currentTrack) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Ionicons name="disc-outline" size={48} color={colors.textSecondary} />
        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>Nothing playing</Text>
      </View>
    );
  }

  const durationMs = duration || currentTrack.duration || 0;
  const ratio = durationMs > 0 ? Math.min(1, Math.max(0, playbackPosition / durationMs)) : 0;

  const progressFill = volumeMode ? volume : ratio;
  const progressLabel = volumeMode ? `VOLUME ${Math.round(volume * 100)}%` : 'SCRUB';

  const artwork = currentTrack.cachedArtwork ?? currentTrack.artwork;
  const trackTime = `${fmtDuration(Math.floor(playbackPosition / 1000))} / ${fmtDuration(Math.floor(durationMs / 1000))}`;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.artWrap}>
        {artwork ? (
          <Image
            source={{ uri: artwork }}
            style={[styles.art, { backgroundColor: colors.card, borderColor: colors.border }]}
            contentFit="cover"
          />
        ) : (
          <View style={[styles.art, styles.artFallback, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Ionicons name="musical-notes" size={48} color={ipod.highlight} />
          </View>
        )}
      </View>

      <Text style={[styles.title, { color: colors.text }]} numberOfLines={2}>
        {currentTrack.title}
      </Text>
      <Text style={[styles.artist, { color: colors.textSecondary }]} numberOfLines={1}>
        {currentTrack.artist}
      </Text>

      <Pressable onPress={onToggleVolume} style={styles.barArea}>
        <Ionicons name={volumeMode ? 'volume-medium' : 'time'} size={14} color={colors.textSecondary} />
        <View style={[styles.bar, { backgroundColor: colors.border }]}>
          <View style={[styles.barFill, { backgroundColor: ipod.highlight, width: `${progressFill * 100}%` }]} />
        </View>
        <Ionicons name={volumeMode ? 'volume-high' : 'musical-notes'} size={14} color={colors.textSecondary} />
      </Pressable>
      <Text style={[styles.scrubLabel, { color: colors.textSecondary }]}>{progressLabel}</Text>
      {!volumeMode ? <Text style={[styles.time, { color: colors.textSecondary }]}>{trackTime}</Text> : null}

      <Pressable onPress={onToggleLyrics} style={styles.lyricsToggle}>
        <Ionicons name={lyricsOpen ? 'musical-notes-off' : 'musical-notes'} size={16} color={ipod.highlight} />
        <Text style={[styles.lyricsToggleText, { color: ipod.highlight }]}>
          {lyricsOpen ? 'Hide Lyrics' : 'Lyrics'}
        </Text>
      </Pressable>

      <View style={styles.hintRow}>
        <Ionicons name="play-skip-back" size={14} color={colors.textSecondary} />
        <Text style={[styles.hint, { color: colors.textSecondary }]}>
          SELECT play/pause · scroll {volumeMode ? 'volume' : 'seek'}
        </Text>
        <Ionicons name="play-skip-forward" size={14} color={colors.textSecondary} />
      </View>

      {lyricsOpen && lyrics ? (
        <View style={[styles.lyricsOverlay, { backgroundColor: colors.background }]}>
          <LyricsDisplay
            lyrics={lyrics}
            playbackPosition={playbackPosition}
            accentColor={ipod.highlight}
            textColor={colors.text}
            secondaryColor={colors.textSecondary}
            onSeek={(pos) => seekTo(pos)}
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    marginTop: 10,
    fontSize: 15,
  },
  artWrap: {
    alignItems: 'center',
  },
  art: {
    width: 148,
    height: 148,
    borderRadius: 10,
    borderWidth: 1,
  },
  artFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    marginTop: 8,
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  artist: {
    marginTop: 1,
    fontSize: 13,
  },
  barArea: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    width: '100%',
    paddingHorizontal: 8,
  },
  bar: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    marginHorizontal: 8,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 3,
  },
  scrubLabel: {
    marginTop: 3,
    fontSize: 10,
    letterSpacing: 1,
    fontWeight: '700',
  },
  time: {
    marginTop: 2,
    fontSize: 11,
    fontVariant: ['tabular-nums'],
  },
  lyricsToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  lyricsToggleText: {
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 4,
  },
  hintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
  },
  hint: {
    fontSize: 11,
    marginHorizontal: 6,
  },
  lyricsOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
});