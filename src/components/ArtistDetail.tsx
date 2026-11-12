import React, { useRef } from 'react';
import { View, StyleSheet, Text, FlatList, Pressable, Animated } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import { useAudio, TrackMetadata } from '../context/AudioContext';
import { ArtistGroup } from '../services/LibraryGrouping';
import { formatDuration } from '../utils/format';

interface ArtistDetailProps {
  artist: ArtistGroup;
  currentTrack: TrackMetadata | null;
  onBack: () => void;
  onAlbumPress: (albumKey: string) => void;
}

export function ArtistDetail({ artist, currentTrack, onBack, onAlbumPress }: ArtistDetailProps) {
  const { colors } = useTheme();
  const { setQueue, loadTrack } = useAudio();
  const playScale = useRef(new Animated.Value(1)).current;

  const playArtist = (shuffle: boolean) => {
    if (artist.tracks.length === 0) return;
    const ordered = shuffle
      ? [...artist.tracks].sort(() => Math.random() - 0.5)
      : artist.tracks;
    setQueue(ordered.slice(1));
    loadTrack(ordered[0].uri, ordered[0], true);
  };

  const playFrom = (track: TrackMetadata) => {
    const index = artist.tracks.findIndex((t) => t.uri === track.uri);
    setQueue(artist.tracks.slice(index + 1));
    loadTrack(track.uri, track, true);
  };

  const renderTrack = ({ item }: { item: TrackMetadata }) => {
    const isCurrent = currentTrack?.uri === item.uri;
    return (
      <Pressable
        style={[styles.trackRow, { backgroundColor: isCurrent ? colors.card : colors.background }]}
        onPress={() => playFrom(item)}
      >
        {item.artwork ? (
          <Image source={{ uri: item.artwork }} style={styles.trackArtwork} cachePolicy="memory-disk" />
        ) : (
          <View style={[styles.trackArtwork, styles.trackArtworkPlaceholder, { backgroundColor: colors.card }]}>
            <Ionicons name="musical-note" size={20} color={colors.textSecondary} />
          </View>
        )}
        <View style={styles.trackInfo}>
          <Text
            style={[styles.trackTitle, { color: isCurrent ? colors.accent : colors.text }]}
            numberOfLines={1}
          >
            {item.title}
          </Text>
          <Text style={[styles.trackSub, { color: colors.textSecondary }]} numberOfLines={1}>
            {item.album ? `${item.album}  ·  ${item.artist}` : item.artist}
          </Text>
        </View>
        {typeof item.duration === 'number' && item.duration > 0 && (
          <Text style={[styles.trackDuration, { color: colors.textSecondary }]}>
            {formatDuration(item.duration)}
          </Text>
        )}
      </Pressable>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <SafeAreaView style={{ backgroundColor: colors.background }} edges={['top']}>
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <Pressable style={styles.backButton} onPress={onBack} hitSlop={8}>
            <Ionicons name="chevron-back" size={28} color={colors.accent} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>
            Artist
          </Text>
        </View>
      </SafeAreaView>

      <FlatList
        data={artist.tracks}
        renderItem={renderTrack}
        keyExtractor={(item) => item.uri}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <View style={styles.hero}>
            <Text style={[styles.artistName, { color: colors.text }]} numberOfLines={2}>
              {artist.artist}
            </Text>
            <Text style={[styles.meta, { color: colors.textSecondary }]}>
              {artist.albums.length} {artist.albums.length === 1 ? 'album' : 'albums'}  ·  {artist.trackCount}{' '}
              {artist.trackCount === 1 ? 'song' : 'songs'}
            </Text>
            <View style={styles.actions}>
              <Animated.View style={{ transform: [{ scale: playScale }] }}>
                <Pressable
                  style={[styles.playButton, { backgroundColor: colors.accent }]}
                  onPress={() => {
                    Animated.sequence([
                      Animated.spring(playScale, { toValue: 0.92, useNativeDriver: true, damping: 10, stiffness: 300 }),
                      Animated.spring(playScale, { toValue: 1, useNativeDriver: true, damping: 10, stiffness: 200 }),
                    ]).start();
                    playArtist(false);
                  }}
                >
                  <Ionicons name="play" size={18} color={colors.onAccent} />
                  <Text style={[styles.playButtonText, { color: colors.onAccent }]}>Play</Text>
                </Pressable>
              </Animated.View>
              <Pressable
                style={[styles.secondaryButton, { borderColor: colors.border }]}
                onPress={() => playArtist(true)}
              >
                <Ionicons name="shuffle" size={18} color={colors.accent} />
                <Text style={[styles.secondaryButtonText, { color: colors.accent }]}>Shuffle</Text>
              </Pressable>
            </View>

            <Text style={[styles.sectionTitle, { color: colors.text }]}>Albums</Text>
            <View style={styles.albumGrid}>
              {artist.albums.map((album) => (
                <Pressable
                  key={album.key}
                  style={styles.albumCard}
                  onPress={() => onAlbumPress(album.key)}
                >
                  {album.artUri ? (
                    <Image source={{ uri: album.artUri }} style={styles.albumArt} cachePolicy="memory-disk" />
                  ) : (
                    <View style={[styles.albumArt, styles.albumArtPlaceholder, { backgroundColor: colors.card }]}>
                      <Ionicons name="disc" size={32} color={colors.textSecondary} />
                    </View>
                  )}
                  <Text style={[styles.albumTitle, { color: colors.text }]} numberOfLines={1}>
                    {album.album}
                  </Text>
                  <Text style={[styles.albumMeta, { color: colors.textSecondary }]} numberOfLines={1}>
                    {album.year ? `${album.year}  ·  ` : ''}
                    {album.trackCount} {album.trackCount === 1 ? 'track' : 'tracks'}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text style={[styles.sectionTitle, { color: colors.text }]}>Songs</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backButton: { padding: 8 },
  headerTitle: { flex: 1, fontSize: 20, fontWeight: '700' },
  listContent: { paddingBottom: 120 },
  hero: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8 },
  artistName: { fontSize: 28, fontWeight: '800' },
  meta: { fontSize: 14, marginTop: 6 },
  actions: { flexDirection: 'row', gap: 12, marginTop: 18 },
  playButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 24,
  },
  playButtonText: { fontSize: 16, fontWeight: '700' },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
    borderWidth: 1,
  },
  secondaryButtonText: { fontSize: 16, fontWeight: '600' },
  sectionTitle: { fontSize: 20, fontWeight: '700', marginTop: 28, marginBottom: 12 },
  albumGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  albumCard: { width: '47%' },
  albumArt: { width: '100%', aspectRatio: 1, borderRadius: 8 },
  albumArtPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  albumTitle: { fontSize: 15, fontWeight: '600', marginTop: 8 },
  albumMeta: { fontSize: 13, marginTop: 2 },
  trackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  trackArtwork: { width: 44, height: 44, borderRadius: 6, marginRight: 12 },
  trackArtworkPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  trackInfo: { flex: 1, marginRight: 12 },
  trackTitle: { fontSize: 16, fontWeight: '600', marginBottom: 2 },
  trackSub: { fontSize: 13 },
  trackDuration: { fontSize: 13 },
});
