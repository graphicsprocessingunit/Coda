import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View, Pressable } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';

import { useAudio, useIsPlaying, usePlaybackPosition } from '../../context/AudioContext';
import { fetchLyrics } from '../../services/LyricsService';
import { LyricsDisplay } from '../LyricsDisplay';
import { fmtDuration } from './menus';
import { IpodStatusBar } from './IpodStatusBar';
import { IPOD_NOWPLAYING, IPOD_SCREEN } from './ipodTheme';

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
  const { currentTrack, volume, seekTo } = useAudio();
  const { isPlaying } = useIsPlaying();
  const { playbackPosition, duration } = usePlaybackPosition();
  const { shuffleEnabled, repeatEnabled } = useAudio();

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
      <View style={styles.emptyScreen}>
        <IpodStatusBar dark />
        <View style={styles.center}>
          <Ionicons name="disc-outline" size={56} color={IPOD_NOWPLAYING.dim} />
          <Text style={styles.emptyText}>Nothing playing</Text>
        </View>
      </View>
    );
  }

  const durationMs = duration || currentTrack.duration || 0;
  const ratio = durationMs > 0 ? Math.min(1, Math.max(0, playbackPosition / durationMs)) : 0;
  const progressFill = volumeMode ? volume : ratio;
  const elapsedSec = Math.floor(playbackPosition / 1000);
  const remainingSec = durationMs > 0 ? Math.floor(durationMs / 1000) - elapsedSec : 0;

  const artwork = currentTrack.cachedArtwork ?? currentTrack.artwork;

  return (
    <View style={styles.screen}>
      <IpodStatusBar dark shuffle={shuffleEnabled} repeat={repeatEnabled} />

      <View style={styles.body}>
        <View style={styles.artRow}>
          {artwork ? (
            <Image
              source={{ uri: artwork }}
              style={styles.art}
              contentFit="cover"
            />
          ) : (
            <View style={[styles.art, styles.artFallback]}>
              <Ionicons name="musical-notes" size={40} color={IPOD_NOWPLAYING.secondary} />
            </View>
          )}
          <View style={styles.info}>
            <Text style={styles.title} numberOfLines={2}>
              {currentTrack.title}
            </Text>
            <Text style={styles.artist} numberOfLines={1}>
              {currentTrack.artist}
            </Text>
            {currentTrack.album ? (
              <Text style={styles.album} numberOfLines={1}>
                {currentTrack.album}
              </Text>
            ) : null}
          </View>
        </View>

        <Pressable onPress={onToggleVolume} style={styles.barArea}>
          <View style={styles.barTrack}>
            <View style={[styles.barFill, { width: `${progressFill * 100}%` }]} />
          </View>
        </Pressable>

        {volumeMode ? (
          <Text style={styles.volumeLabel}>VOLUME</Text>
        ) : (
          <View style={styles.timeRow}>
            <Text style={styles.timeText}>{fmtDuration(elapsedSec)}</Text>
            <Text style={styles.timeText}>{remainingSec > 0 ? `-${fmtDuration(remainingSec)}` : ''}</Text>
          </View>
        )}

        <View style={styles.controlsRow}>
          <Pressable onPress={onToggleLyrics} hitSlop={6} style={styles.lyricsToggle}>
            <Ionicons
              name={lyricsOpen ? 'close' : 'musical-notes'}
              size={13}
              color={IPOD_NOWPLAYING.secondary}
            />
            <Text style={styles.lyricsToggleText}>{lyricsOpen ? 'Hide Lyrics' : 'Lyrics'}</Text>
          </Pressable>
          <Text style={styles.hint} numberOfLines={1}>
            {isPlaying ? 'SELECT p a u s e' : 'SELECT p l a y'} · scroll{' '}
            {volumeMode ? 'volume' : 'seek'}
          </Text>
        </View>
      </View>

      {lyricsOpen && lyrics ? (
        <View style={styles.lyricsOverlay}>
          <LyricsDisplay
            lyrics={lyrics}
            playbackPosition={playbackPosition}
            accentColor={IPOD_SCREEN.highlightBottom}
            textColor={IPOD_NOWPLAYING.text}
            secondaryColor={IPOD_NOWPLAYING.dim}
            onSeek={(pos) => seekTo(pos)}
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: IPOD_NOWPLAYING.bg,
  },
  emptyScreen: {
    flex: 1,
    backgroundColor: IPOD_NOWPLAYING.bg,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    marginTop: 12,
    fontSize: 14,
    color: IPOD_NOWPLAYING.secondary,
  },
  body: {
    flex: 1,
    paddingHorizontal: 12,
    paddingTop: 6,
  },
  artRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  art: {
    width: 96,
    height: 96,
    borderRadius: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: IPOD_NOWPLAYING.border,
    backgroundColor: '#111111',
  },
  artFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: {
    flex: 1,
    marginLeft: 12,
    paddingTop: 2,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 3,
  },
  artist: {
    fontSize: 13,
    color: IPOD_NOWPLAYING.secondary,
    marginBottom: 1,
  },
  album: {
    fontSize: 12,
    color: IPOD_NOWPLAYING.dim,
  },
  barArea: {
    marginTop: 14,
  },
  barTrack: {
    height: 3,
    borderRadius: 2,
    backgroundColor: IPOD_NOWPLAYING.track,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    backgroundColor: IPOD_NOWPLAYING.fill,
  },
  volumeLabel: {
    alignSelf: 'center',
    marginTop: 5,
    fontSize: 9,
    letterSpacing: 2,
    color: IPOD_NOWPLAYING.secondary,
    fontWeight: '600',
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  timeText: {
    fontSize: 10,
    color: IPOD_NOWPLAYING.dim,
    fontVariant: ['tabular-nums'],
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 'auto',
    paddingVertical: 8,
    paddingHorizontal: 2,
  },
  lyricsToggle: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  lyricsToggleText: {
    marginLeft: 4,
    fontSize: 12,
    color: IPOD_NOWPLAYING.secondary,
    fontWeight: '500',
  },
  hint: {
    fontSize: 11,
    color: IPOD_NOWPLAYING.dim,
  },
  lyricsOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: IPOD_NOWPLAYING.bg,
  },
});