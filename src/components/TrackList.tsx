import React, { useEffect, useRef, useState, useMemo } from 'react';
import { View, StyleSheet, Text, FlatList, Pressable, Image, Animated, TextInput, Modal, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import { useAudio, useDownloadProgress, TrackMetadata } from '../context/AudioContext';
import { SwipeableRow } from './SwipeableRow';
import { NavidromeBrowser } from './NavidromeBrowser';
import { EmptyState } from './EmptyState';
import { OfflineCacheService } from '../services/OfflineCacheService';

type FilterMode = 'all' | 'favorites' | 'downloads';
type SortMode = 'title' | 'playCount';

interface TrackListProps {
  tracks: TrackMetadata[];
  currentTrack: TrackMetadata | null;
  onTrackPress: (track: TrackMetadata) => void;
  onAddTracks: () => void;
  onTrackLongPress?: (track: TrackMetadata) => void;
  onRemoveTrack?: (trackUri: string) => void;
  onToggleFavorite?: (uri: string) => void;
  onBatchFavorite?: (uris: string[]) => void;
  onBatchAddToPlaylist?: (uris: string[]) => void;
  onBatchRemove?: (uris: string[]) => void;
  onBatchDownload?: (tracks: TrackMetadata[]) => void;
  onDownload?: (track: TrackMetadata) => Promise<string | null>;
}

const AnimatedTrackItem = React.memo(function AnimatedTrackItem({ item, index, isCurrentTrack, colors, onPress, onLongPress, onToggleFavorite, downloadProgress, downloadError, onCancelDownload, selectionMode, isSelected, onToggleSelection }: {
  item: TrackMetadata;
  index: number;
  isCurrentTrack: boolean;
  colors: any;
  onPress: (item: TrackMetadata) => void;
  onLongPress?: (item: TrackMetadata) => void;
  onToggleFavorite?: (uri: string) => void;
  downloadProgress?: number;
  downloadError?: string;
  onCancelDownload?: () => void;
  selectionMode?: boolean;
  isSelected?: boolean;
  onToggleSelection?: () => void;
}) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(20)).current;
  const pressScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 300, delay: index * 50, useNativeDriver: true }),
      Animated.spring(translateY, { toValue: 0, useNativeDriver: true, damping: 15, stiffness: 100, delay: index * 50 }),
    ]).start();
  }, []);

  const handlePressIn = () => {
    Animated.spring(pressScale, { toValue: 0.97, useNativeDriver: true, damping: 15, stiffness: 300 }).start();
  };

  const handlePressOut = () => {
    Animated.spring(pressScale, { toValue: 1, useNativeDriver: true, damping: 15, stiffness: 200 }).start();
  };

  const handlePress = () => {
    if (selectionMode && onToggleSelection) {
      onToggleSelection();
    } else {
      onPress(item);
    }
  };

  return (
    <Animated.View style={{ opacity, transform: [{ translateY }, { scale: pressScale }] }}>
      <Pressable
        style={[styles.trackItem, { backgroundColor: colors.background }, isCurrentTrack && !selectionMode && { backgroundColor: colors.card }, isSelected && { backgroundColor: colors.accent + '15' }]}
        onPress={handlePress}
        onLongPress={!selectionMode && onLongPress ? () => onLongPress(item) : undefined}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
      >
        <View style={styles.trackNumber}>
          {selectionMode ? (
            <Ionicons
              name={isSelected ? 'checkmark-circle' : 'ellipse-outline'}
              size={22}
              color={isSelected ? colors.accent : colors.textSecondary}
            />
          ) : typeof downloadProgress === 'number' ? (
            <ActivityIndicator size="small" color={colors.accent} />
          ) : item.source === 'navidrome' ? (
            <Ionicons name="cloud-outline" size={16} color={colors.textSecondary} />
          ) : (
            <Text style={[styles.trackNumberText, { color: colors.textSecondary }, isCurrentTrack && { color: colors.accent }]}>
              {isCurrentTrack ? (
                <Ionicons name="musical-notes" size={16} color={colors.accent} />
              ) : (
                index + 1
              )}
            </Text>
          )}
        </View>

        {item.artwork ? (
          <Image source={{ uri: item.artwork }} style={styles.trackArtwork} />
        ) : (
          <View style={[styles.trackArtworkPlaceholder, { backgroundColor: colors.card }]}>
            <Ionicons name="musical-note" size={24} color={colors.textSecondary} />
          </View>
        )}

        <View style={styles.trackInfo}>
          <Text
            style={[styles.trackTitle, { color: colors.text }, isCurrentTrack && !selectionMode && { color: colors.accent }]}
            numberOfLines={1}
          >
            {item.title}
          </Text>
          <Text style={[styles.trackArtist, { color: colors.textSecondary }]} numberOfLines={1}>
            {item.artist}
          </Text>
          {typeof downloadProgress === 'number' && (
            <View style={styles.downloadProgressContainer}>
              {downloadProgress < 0 ? (
                <ActivityIndicator size="small" color={colors.accent} />
              ) : (
                <View style={[styles.downloadProgressBar, { backgroundColor: colors.border }]}>
                  <View style={[styles.downloadProgressFill, {
                    backgroundColor: colors.accent,
                    width: `${Math.min(downloadProgress * 100, 100)}%`,
                  }]} />
                </View>
              )}
              <Text style={[styles.downloadProgressText, { color: colors.textSecondary }]}>
                {downloadProgress >= 1 ? 'Done' : downloadProgress < 0
                  ? `${Math.round(-downloadProgress)} KB`
                  : `${Math.round(downloadProgress * 100)}%`}
              </Text>
              {onCancelDownload && downloadProgress < 1 && (
                <Pressable onPress={onCancelDownload} hitSlop={4} style={styles.cancelDownloadButton}>
                  <Ionicons name="close-circle" size={18} color={colors.textSecondary} />
                </Pressable>
              )}
            </View>
          )}
          {downloadError && (
            <View style={styles.downloadProgressContainer}>
              <Ionicons name="alert-circle" size={14} color="#FF3B30" />
              <Text style={[styles.downloadProgressText, { color: '#FF3B30' }]} numberOfLines={1}>
                {downloadError}
              </Text>
            </View>
          )}
        </View>

        {!selectionMode && isCurrentTrack && (
          <Ionicons name="play" size={20} color={colors.accent} />
        )}
        {!selectionMode && onToggleFavorite && (
          <Pressable onPress={(e) => { e.stopPropagation(); onToggleFavorite(item.uri); }} hitSlop={8} style={styles.heartButton}>
            <Ionicons
              name="heart"
              size={20}
              color={item.isFavorite ? '#FF2D55' : colors.textSecondary}
            />
          </Pressable>
        )}
      </Pressable>
    </Animated.View>
  );
});

export function TrackList({ tracks, currentTrack, onTrackPress, onAddTracks, onTrackLongPress, onRemoveTrack, onToggleFavorite, onBatchFavorite, onBatchAddToPlaylist, onBatchRemove, onBatchDownload, onDownload }: TrackListProps) {
  const { colors } = useTheme();
  const { navidromeConnected, addToLibrary, getNavidromeCredentials } = useAudio();
  const { activeDownloads, cancelDownload } = useDownloadProgress();
  const [searchQuery, setSearchQuery] = useState('');
  const [showNavidrome, setShowNavidrome] = useState(false);
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const [sortMode, setSortMode] = useState<SortMode>('title');
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedUris, setSelectedUris] = useState<Set<string>>(new Set());
  const [downloadErrors, setDownloadErrors] = useState<Map<string, string>>(new Map());

  const trackKeyExtractor = useMemo(() => (item: TrackMetadata) => item.uri, []);
  const getItemLayout = useMemo(() => (_: any, index: number) => ({ length: 72, offset: 72 * index, index }), []);

  const filteredTracks = useMemo(() => {
    let result = tracks;

    if (filterMode === 'favorites') {
      result = result.filter((t) => t.isFavorite);
    } else if (filterMode === 'downloads') {
      const downloadingUris = activeDownloads ? [...activeDownloads.keys()] : [];
      result = result.filter((t) => OfflineCacheService.isTrackCached(t) || downloadingUris.includes(t.uri));
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (t) => t.title.toLowerCase().includes(q) || t.artist.toLowerCase().includes(q)
      );
    }

    if (sortMode === 'playCount') {
      result = [...result].sort((a, b) => (b.playCount || 0) - (a.playCount || 0));
    } else {
      result = [...result].sort((a, b) => a.title.localeCompare(b.title));
    }

    return result;
  }, [tracks, searchQuery, filterMode, sortMode, activeDownloads]);

  const handleTrackLongPress = (track: TrackMetadata) => {
    setSelectionMode(true);
    setSelectedUris(new Set([track.uri]));
  };

  const isTrackDownloadable = (track: TrackMetadata) => {
    return track.source === 'navidrome' && !OfflineCacheService.isTrackCached(track) && !activeDownloads?.has(track.uri);
  };

  const handleTrackDownload = async (track: TrackMetadata) => {
    if (isTrackDownloadable(track)) {
      if (onDownload) {
        const error = await onDownload(track);
        if (error) {
          setDownloadErrors(prev => new Map(prev).set(track.uri, error));
          setTimeout(() => {
            setDownloadErrors(prev => {
              const next = new Map(prev);
              next.delete(track.uri);
              return next;
            });
          }, 3000);
        }
      } else {
        const creds = getNavidromeCredentials();
        if (creds) {
          OfflineCacheService.downloadTrackForOffline(creds, track).catch(() => {});
        }
      }
    }
  };

  const renderTrack = ({ item, index }: { item: TrackMetadata; index: number }) => {
    const isCurrentTrack = currentTrack?.uri === item.uri;
    const downloadProgress = activeDownloads?.get(item.uri);
    const isSelected = selectedUris.has(item.uri);
    const downloadError = downloadErrors.get(item.uri);

    const trackContent = (
      <AnimatedTrackItem
        item={item}
        index={index}
        isCurrentTrack={isCurrentTrack}
        colors={colors}
        onPress={onTrackPress}
        onLongPress={handleTrackLongPress}
        onToggleFavorite={onToggleFavorite}
        downloadProgress={downloadProgress}
        downloadError={downloadError}
        onCancelDownload={typeof downloadProgress === 'number' ? () => cancelDownload(item.uri) : undefined}
        selectionMode={selectionMode}
        isSelected={isSelected}
        onToggleSelection={selectionMode ? () => {
          setSelectedUris(prev => {
            const next = new Set(prev);
            if (next.has(item.uri)) next.delete(item.uri);
            else next.add(item.uri);
            return next;
          });
        } : undefined}
      />
    );

    if (!selectionMode) {
      const canDownload = isTrackDownloadable(item);
      return (
        <SwipeableRow
          onDelete={onRemoveTrack ? () => onRemoveTrack(item.uri) : undefined}
          onDownload={canDownload ? () => handleTrackDownload(item) : undefined}
        >
          {trackContent}
        </SwipeableRow>
      );
    }
    return trackContent;
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Library</Text>
        <View style={styles.headerButtons}>
          <Pressable style={styles.navidromeButton} onPress={() => setShowNavidrome(true)}>
            <Ionicons
              name="server-outline"
              size={24}
              color={navidromeConnected ? '#34C759' : colors.textSecondary}
            />
          </Pressable>
          <Pressable style={styles.addButton} onPress={onAddTracks}>
            <Ionicons name="add-circle" size={24} color={colors.accent} />
          </Pressable>
        </View>
      </View>

      {selectionMode && (
        <View style={[styles.selectionHeader, { borderBottomColor: colors.border, backgroundColor: colors.background }]}>
          <Pressable onPress={() => setSelectedUris(new Set(filteredTracks.map(t => t.uri)))}>
            <Text style={[styles.selectionAction, { color: colors.accent }]}>All</Text>
          </Pressable>
          <Pressable onPress={() => setSelectedUris(new Set())}>
            <Text style={[styles.selectionAction, { color: colors.textSecondary }]}>None</Text>
          </Pressable>
          <Pressable onPress={() => { setSelectionMode(false); setSelectedUris(new Set()); }}>
            <Text style={[styles.selectionAction, { color: colors.accent }]}>Done</Text>
          </Pressable>
        </View>
      )}

      {tracks.length > 0 && !selectionMode && (
        <View style={[styles.searchContainer, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
          <Ionicons name="search" size={18} color={colors.textSecondary} style={styles.searchIcon} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="Search tracks..."
            placeholderTextColor={colors.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCorrect={false}
          />
          {searchQuery.length > 0 && (
            <Pressable onPress={() => setSearchQuery('')} hitSlop={8}>
              <Ionicons name="close-circle" size={18} color={colors.textSecondary} />
            </Pressable>
          )}
        </View>
      )}

      {tracks.length > 0 && !selectionMode && (
        <View style={[styles.filterBar, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
          <View style={styles.filterChips}>
            <Pressable
              style={[styles.filterChip, { borderColor: colors.border }, filterMode === 'all' && { backgroundColor: colors.accent, borderColor: colors.accent }]}
              onPress={() => setFilterMode('all')}
            >
              <Text style={[styles.filterChipText, { color: filterMode === 'all' ? '#FFFFFF' : colors.text }]}>All</Text>
            </Pressable>
            <Pressable
              style={[styles.filterChip, { borderColor: colors.border }, filterMode === 'favorites' && { backgroundColor: '#FF2D55', borderColor: '#FF2D55' }]}
              onPress={() => setFilterMode('favorites')}
            >
              <Ionicons name="heart" size={14} color={filterMode === 'favorites' ? '#FFFFFF' : '#FF2D55'} />
              <Text style={[styles.filterChipText, { color: filterMode === 'favorites' ? '#FFFFFF' : colors.text }]}>Favorites</Text>
            </Pressable>
            <Pressable
              style={[styles.filterChip, { borderColor: colors.border }, filterMode === 'downloads' && { backgroundColor: '#34C759', borderColor: '#34C759' }]}
              onPress={() => setFilterMode('downloads')}
            >
              <Ionicons name="download-outline" size={14} color={filterMode === 'downloads' ? '#FFFFFF' : '#34C759'} />
              <Text style={[styles.filterChipText, { color: filterMode === 'downloads' ? '#FFFFFF' : colors.text }]}>Downloads</Text>
            </Pressable>
          </View>
          <Pressable
            style={styles.sortButton}
            onPress={() => setSortMode((prev) => prev === 'title' ? 'playCount' : 'title')}
          >
            <Ionicons
              name={sortMode === 'playCount' ? 'trophy' : 'arrow-down'}
              size={18}
              color={sortMode === 'playCount' ? colors.accent : colors.textSecondary}
            />
          </Pressable>
        </View>
      )}

      {tracks.length === 0 ? (
        <EmptyState
          icon="musical-notes"
          decorativeIcons={[
            { name: 'mic-outline', offset: { x: -30, y: -25 }, size: 22, delay: 400 },
            { name: 'headset-outline', offset: { x: 30, y: -20 }, size: 20, delay: 600 },
            { name: 'disc-outline', offset: { x: -20, y: 25 }, size: 18, delay: 800 },
          ]}
          title="Welcome to Coda"
          subtitle="Import music from your device or connect to Navidrome to get started."
          action={{ label: 'Import Music', onPress: onAddTracks, primary: true, icon: 'cloud-upload' }}
          secondaryAction={{ label: 'Connect Navidrome', onPress: () => setShowNavidrome(true), icon: 'server-outline' }}
        />
      ) : filteredTracks.length === 0 ? (
        <EmptyState
          icon="search"
          decorativeIcons={[
            { name: 'close-circle-outline', offset: { x: 25, y: -20 }, size: 18, delay: 400 },
          ]}
          title="No matches"
          subtitle="Try a different search"
        />
      ) : (
        <FlatList
          data={filteredTracks}
          renderItem={renderTrack}
          keyExtractor={trackKeyExtractor}
          style={styles.list}
          contentContainerStyle={styles.listContent}
          getItemLayout={getItemLayout}
          removeClippedSubviews
        />
      )}

      {selectedUris.size > 0 && (
        <View style={[styles.batchBar, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
          <Text style={[styles.batchCount, { color: colors.text }]}>{selectedUris.size} selected</Text>
          <View style={styles.batchActions}>
            {onBatchFavorite && (
              <Pressable style={styles.batchButton} onPress={() => onBatchFavorite([...selectedUris])}>
                <Ionicons name="heart" size={20} color={colors.accent} />
              </Pressable>
            )}
            {onBatchAddToPlaylist && (
              <Pressable style={styles.batchButton} onPress={() => onBatchAddToPlaylist([...selectedUris])}>
                <Ionicons name="list" size={20} color={colors.accent} />
              </Pressable>
            )}
            {onBatchDownload && (
              <Pressable style={styles.batchButton} onPress={() => {
                const tracks = filteredTracks.filter(t => selectedUris.has(t.uri));
                onBatchDownload(tracks);
              }}>
                <Ionicons name="download" size={20} color={colors.accent} />
              </Pressable>
            )}
            {onBatchRemove && (
              <Pressable style={styles.batchButton} onPress={() => onBatchRemove([...selectedUris])}>
                <Ionicons name="trash" size={20} color="#FF3B30" />
              </Pressable>
            )}
          </View>
        </View>
      )}

      <Modal
        visible={showNavidrome}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowNavidrome(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.background }]}>
            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Navidrome</Text>
              <Pressable onPress={() => setShowNavidrome(false)} hitSlop={10}>
                <Ionicons name="close" size={28} color={colors.textSecondary} />
              </Pressable>
            </View>
            <NavidromeBrowser mode="addToLibrary" onAddTracks={(newTracks) => {
              addToLibrary(newTracks);
              setShowNavidrome(false);
            }} />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: '700',
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  navidromeButton: {
    padding: 8,
  },
  addButton: {
    padding: 8,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 4,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: 'rgba(128,128,128,0.12)',
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 10,
    fontSize: 16,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingVertical: 8,
  },
  trackItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  trackNumber: {
    width: 32,
    alignItems: 'center',
    marginRight: 12,
  },
  trackNumberText: {
    fontSize: 16,
    fontWeight: '600',
  },
  trackArtwork: {
    width: 48,
    height: 48,
    borderRadius: 6,
    marginRight: 12,
  },
  trackArtworkPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  trackInfo: {
    flex: 1,
    marginRight: 12,
  },
  trackTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  trackArtist: {
    fontSize: 14,
  },
  filterBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  filterChips: {
    flexDirection: 'row',
    gap: 8,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  sortButton: {
    padding: 8,
  },
  heartButton: {
    marginLeft: 8,
  },
  downloadProgressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    gap: 8,
  },
  downloadProgressBar: {
    flex: 1,
    height: 3,
    borderRadius: 1.5,
    overflow: 'hidden',
  },
  downloadProgressFill: {
    height: '100%',
    borderRadius: 1.5,
  },
  downloadProgressText: {
    fontSize: 11,
    minWidth: 32,
    textAlign: 'right',
  },
  cancelDownloadButton: {
    padding: 2,
  },
  selectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  selectionAction: {
    fontSize: 16,
    fontWeight: '600',
  },
  batchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderTopWidth: 1,
  },
  batchCount: {
    fontSize: 14,
    fontWeight: '600',
  },
  batchActions: {
    flexDirection: 'row',
    gap: 16,
  },
  batchButton: {
    padding: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
  },
  modalContent: {
    borderRadius: 20,
    marginHorizontal: 20,
    maxHeight: '80%',
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '700',
  },
});
