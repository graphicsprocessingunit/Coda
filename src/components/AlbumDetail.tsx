import React, { useMemo, useRef } from 'react';
import { View, StyleSheet, Text, FlatList, Pressable, Animated, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import { useAudio, useDownloadProgress, useBatchDownloads, TrackMetadata } from '../context/AudioContext';
import { AlbumGroup } from '../services/LibraryGrouping';
import { OfflineCacheService } from '../services/OfflineCacheService';
import { formatDuration, formatLongDuration } from '../utils/format';

interface AlbumDetailProps {
  album: AlbumGroup;
  currentTrack: TrackMetadata | null;
  onBack: () => void;
}

export function AlbumDetail({ album, currentTrack, onBack }: AlbumDetailProps) {
  const { colors } = useTheme();
  const { setQueue, loadTrack, toggleFavorite } = useAudio();
  const { activeDownloads, cancelDownload } = useDownloadProgress();
  const { batches, startBatchDownload, cancelBatch, retryBatch, dismissBatch } = useBatchDownloads();
  const playScale = useRef(new Animated.Value(1)).current;

  const batchId = `album:${album.key}`;
  const batch = batches.get(batchId);

  const downloadable = useMemo(
    () =>
      album.tracks.filter(
        (t) => t.source === 'navidrome' && t.navidromeId && !OfflineCacheService.isTrackCached(t)
      ),
    [album.tracks]
  );

  const press = (value: Animated.Value, peak: number, action: () => void) => {
    Animated.sequence([
      Animated.spring(value, { toValue: peak, useNativeDriver: true, damping: 10, stiffness: 300 }),
      Animated.spring(value, { toValue: 1, useNativeDriver: true, damping: 10, stiffness: 200 }),
    ]).start();
    action();
  };

  const playAlbum = (shuffle: boolean) => {
    if (album.tracks.length === 0) return;
    const ordered = shuffle
      ? [...album.tracks].sort(() => Math.random() - 0.5)
      : album.tracks;
    setQueue(ordered.slice(1));
    loadTrack(ordered[0].uri, ordered[0], true);
  };

  const playFrom = (track: TrackMetadata) => {
    const index = album.tracks.findIndex((t) => t.uri === track.uri);
    setQueue(album.tracks.slice(index + 1));
    loadTrack(track.uri, track, true);
  };

  const renderTrack = ({ item, index }: { item: TrackMetadata; index: number }) => {
    const isCurrent = currentTrack?.uri === item.uri;
    const progress = activeDownloads?.get(item.uri);
    const isCached = OfflineCacheService.isTrackCached(item);
    return (
      <Pressable
        style={[styles.trackRow, { backgroundColor: isCurrent ? colors.card : colors.background }]}
        onPress={() => playFrom(item)}
        onLongPress={() => toggleFavorite(item.uri)}
      >
        <View style={styles.trackNumber}>
          {isCurrent ? (
            <Ionicons name="musical-notes" size={16} color={colors.accent} />
          ) : (
            <Text style={[styles.trackNumberText, { color: colors.textSecondary }]}>
              {item.trackNumber ?? index + 1}
            </Text>
          )}
        </View>
        <View style={styles.trackInfo}>
          <Text
            style={[styles.trackTitle, { color: isCurrent ? colors.accent : colors.text }]}
            numberOfLines={1}
          >
            {item.title}
          </Text>
          <Text style={[styles.trackArtist, { color: colors.textSecondary }]} numberOfLines={1}>
            {item.artist}
          </Text>
          {typeof progress === 'number' && progress < 1 && (
            <View style={styles.downloadProgressContainer}>
              {progress < 0 ? (
                <ActivityIndicator size="small" color={colors.accent} />
              ) : (
                <View style={[styles.downloadProgressBar, { backgroundColor: colors.border }]}>
                  <View
                    style={[
                      styles.downloadProgressFill,
                      { backgroundColor: colors.accent, width: `${Math.min(progress * 100, 100)}%` },
                    ]}
                  />
                </View>
              )}
              <Text style={[styles.downloadProgressText, { color: colors.textSecondary }]}>
                {progress < 0 ? `${Math.round(-progress)} KB` : `${Math.round(progress * 100)}%`}
              </Text>
              <Pressable
                onPress={() => cancelDownload(item.uri)}
                hitSlop={4}
                style={styles.cancelDownloadButton}
              >
                <Ionicons name="close-circle" size={16} color={colors.textSecondary} />
              </Pressable>
            </View>
          )}
        </View>
        {item.source === 'navidrome' && (
          <Ionicons
            name={isCached ? 'checkmark-circle' : progress !== undefined ? 'cloud-download' : 'cloud-outline'}
            size={16}
            color={isCached ? colors.success : colors.textSecondary}
            style={styles.trackStatusIcon}
          />
        )}
        {typeof item.duration === 'number' && item.duration > 0 && (
          <Text style={[styles.trackDuration, { color: colors.textSecondary }]}>
            {formatDuration(item.duration)}
          </Text>
        )}
      </Pressable>
    );
  };

  const metaParts = [
    album.albumArtist,
    album.year ? String(album.year) : null,
    `${album.trackCount} ${album.trackCount === 1 ? 'track' : 'tracks'}`,
    album.totalDuration > 0 ? formatLongDuration(album.totalDuration) : null,
  ].filter(Boolean) as string[];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <SafeAreaView style={{ backgroundColor: colors.background }} edges={['top']}>
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <Pressable style={styles.backButton} onPress={onBack} hitSlop={8}>
            <Ionicons name="chevron-back" size={28} color={colors.accent} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>
            Album
          </Text>
          {downloadable.length > 0 && !batch?.running && (
            <Pressable
              style={styles.headerAction}
              hitSlop={8}
              onPress={() => startBatchDownload(album.tracks, album.album, batchId)}
            >
              <Ionicons name="cloud-download" size={24} color={colors.accent} />
            </Pressable>
          )}
          {batch?.running && (
            <Pressable style={styles.headerAction} hitSlop={8} onPress={() => cancelBatch(batchId)}>
              <Ionicons name="close-circle" size={24} color={colors.danger} />
            </Pressable>
          )}
        </View>

        {batch?.running && (
          <View style={[styles.batchProgress, { borderBottomColor: colors.border }]}>
            <View style={[styles.batchProgressTrack, { backgroundColor: colors.border }]}>
              <View
                style={[
                  styles.batchProgressFill,
                  {
                    backgroundColor: colors.accent,
                    width: `${batch.total > 0 ? Math.min((batch.completed / batch.total) * 100, 100) : 0}%`,
                  },
                ]}
              />
            </View>
            <Text style={[styles.batchProgressLabel, { color: colors.textSecondary }]}>
              {batch.completed}/{batch.total} downloaded
              {batch.skipped > 0 ? ` \u00b7 ${batch.skipped} already offline` : ''}
            </Text>
          </View>
        )}

        {batch && !batch.running && (
          <View
            style={[
              styles.batchBanner,
              {
                backgroundColor: batch.cancelled
                  ? colors.card
                  : batch.failed.length > 0
                    ? colors.danger + '15'
                    : colors.success + '15',
              },
            ]}
          >
            <Ionicons
              name={batch.cancelled ? 'information-circle' : batch.failed.length > 0 ? 'alert-circle' : 'checkmark-circle'}
              size={18}
              color={batch.cancelled ? colors.textSecondary : batch.failed.length > 0 ? colors.danger : colors.success}
            />
            <Text
              style={[
                styles.batchBannerText,
                { color: batch.cancelled ? colors.text : batch.failed.length > 0 ? colors.danger : colors.success },
              ]}
            >
              {batch.cancelled
                ? `Cancelled \u2014 ${batch.completed}/${batch.total} downloaded`
                : batch.failed.length > 0
                  ? `${batch.completed} downloaded, ${batch.failed.length} failed`
                  : batch.skipped === batch.total
                    ? 'All tracks were already offline'
                    : `Download complete${batch.skipped > 0 ? ` (${batch.skipped} already offline)` : ''}`}
            </Text>
            {batch.failed.length > 0 && !batch.cancelled && (
              <Pressable onPress={() => retryBatch(batchId)} hitSlop={8}>
                <Text style={[styles.batchBannerAction, { color: colors.accent }]}>Retry</Text>
              </Pressable>
            )}
            <Pressable onPress={() => dismissBatch(batchId)} hitSlop={8}>
              <Ionicons name="close" size={16} color={colors.textSecondary} />
            </Pressable>
          </View>
        )}
      </SafeAreaView>

      <FlatList
        data={album.tracks}
        renderItem={renderTrack}
        keyExtractor={(item) => item.uri}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <View style={styles.hero}>
            {album.artUri ? (
              <Image source={{ uri: album.artUri }} style={styles.artwork} cachePolicy="memory-disk" />
            ) : (
              <View style={[styles.artwork, styles.artworkPlaceholder, { backgroundColor: colors.card }]}>
                <Ionicons name="disc" size={64} color={colors.textSecondary} />
              </View>
            )}
            <Text style={[styles.albumName, { color: colors.text }]} numberOfLines={2}>
              {album.album}
            </Text>
            <Text style={[styles.meta, { color: colors.textSecondary }]} numberOfLines={2}>
              {metaParts.join('  ·  ')}
            </Text>
            <View style={styles.actions}>
              <Animated.View style={{ transform: [{ scale: playScale }] }}>
                <Pressable
                  style={[styles.playButton, { backgroundColor: colors.accent }]}
                  onPress={() => press(playScale, 0.92, () => playAlbum(false))}
                >
                  <Ionicons name="play" size={18} color={colors.onAccent} />
                  <Text style={[styles.playButtonText, { color: colors.onAccent }]}>Play</Text>
                </Pressable>
              </Animated.View>
              <Pressable
                style={[styles.secondaryButton, { borderColor: colors.border }]}
                onPress={() => playAlbum(true)}
              >
                <Ionicons name="shuffle" size={18} color={colors.accent} />
                <Text style={[styles.secondaryButtonText, { color: colors.accent }]}>Shuffle</Text>
              </Pressable>
            </View>
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
  headerAction: { padding: 8 },
  batchProgress: {
    paddingHorizontal: 20,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 6,
  },
  batchProgressTrack: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  batchProgressFill: {
    height: '100%',
    borderRadius: 2,
  },
  batchProgressLabel: {
    fontSize: 12,
  },
  batchBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 10,
  },
  batchBannerText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
  },
  batchBannerAction: {
    fontSize: 13,
    fontWeight: '700',
  },
  downloadProgressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  downloadProgressBar: {
    flex: 1,
    height: 3,
    borderRadius: 2,
    overflow: 'hidden',
  },
  downloadProgressFill: {
    height: '100%',
    borderRadius: 2,
  },
  downloadProgressText: {
    fontSize: 11,
    minWidth: 34,
  },
  cancelDownloadButton: {
    padding: 2,
  },
  listContent: { paddingBottom: 120 },
  hero: { alignItems: 'center', paddingHorizontal: 24, paddingTop: 16, paddingBottom: 20 },
  artwork: { width: 180, height: 180, borderRadius: 10 },
  artworkPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  albumName: { fontSize: 24, fontWeight: '700', textAlign: 'center', marginTop: 16 },
  meta: { fontSize: 14, textAlign: 'center', marginTop: 8 },
  actions: { flexDirection: 'row', gap: 12, marginTop: 20 },
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
  trackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  trackNumber: { width: 28, alignItems: 'center', marginRight: 12 },
  trackNumberText: { fontSize: 15, fontWeight: '500' },
  trackInfo: { flex: 1, marginRight: 12 },
  trackTitle: { fontSize: 16, fontWeight: '600', marginBottom: 2 },
  trackArtist: { fontSize: 13 },
  trackStatusIcon: { marginRight: 8 },
  trackDuration: { fontSize: 13 },
});
