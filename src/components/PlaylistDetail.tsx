import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { View, StyleSheet, Text, FlatList, Pressable, Modal, TextInput, Animated, Easing, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import { useAudio, useDownloadProgress, useBatchDownloads, TrackMetadata, Playlist } from '../context/AudioContext';
import { SwipeableRow } from './SwipeableRow';
import { NavidromeBrowser } from './NavidromeBrowser';
import { EmptyState } from './EmptyState';
import { PanResponderView } from './PanResponderView';
import { OfflineCacheService } from '../services/OfflineCacheService';

interface PlaylistDetailProps {
  playlist: Playlist;
  currentTrack: TrackMetadata | null;
  onTrackPress: (track: TrackMetadata) => void;
  onRemoveTrack: (trackUri: string) => void;
  onReorderTrack?: (fromIndex: number, toIndex: number) => void;
  onPlayPlaylist: () => void;
  onBack: () => void;
  onAddTrack?: (track: TrackMetadata) => void;
  onRename?: (newName: string) => void;
  library?: TrackMetadata[];
  onBatchRemoveFromPlaylist?: (uris: string[]) => void;
  onBatchPlaySelected?: (tracks: TrackMetadata[]) => void;
}

function AnimatedCollageImage({ artwork, index, colors }: { artwork: string | undefined; index: number; colors: any }) {
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(opacity, { toValue: 1, duration: 400, delay: index * 100, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, []);

  return (
    <Animated.View style={[styles.collageItem, { opacity }]}>
      {artwork ? (
        <Image source={{ uri: artwork }} style={styles.collageImage} cachePolicy="memory-disk" />
      ) : (
        <View style={[styles.collagePlaceholder, { backgroundColor: colors.border }]}>
          <Ionicons name="musical-note" size={32} color={colors.textSecondary} />
        </View>
      )}
    </Animated.View>
  );
}

export function PlaylistDetail({
  playlist,
  currentTrack,
  onTrackPress,
  onRemoveTrack,
  onReorderTrack,
  onPlayPlaylist,
  onBack,
  onAddTrack,
  onRename,
  library = [],
  onBatchRemoveFromPlaylist,
  onBatchPlaySelected,
}: PlaylistDetailProps) {
  const { colors } = useTheme();
  const { navidromeConnected, addTrackToPlaylist } = useAudio();
  const { activeDownloads, cancelDownload } = useDownloadProgress();
  const { batches, startBatchDownload, cancelBatch, retryBatch, dismissBatch } = useBatchDownloads();
  const [showAddModal, setShowAddModal] = useState(false);
  const [showNavidromeModal, setShowNavidromeModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [editNameValue, setEditNameValue] = useState('');
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedUris, setSelectedUris] = useState<Set<string>>(new Set());
  const itemHeight = 72;

  const playButtonScale = useRef(new Animated.Value(1)).current;

  const handlePlayPress = () => {
    Animated.sequence([
      Animated.spring(playButtonScale, { toValue: 0.85, useNativeDriver: true, damping: 10, stiffness: 300 }),
      Animated.spring(playButtonScale, { toValue: 1, useNativeDriver: true, damping: 10, stiffness: 200 }),
    ]).start();
    onPlayPlaylist();
  };

  const playlistTrackUris = useMemo(() => new Set(playlist.tracks.map((t) => t.uri)), [playlist.tracks]);

  const filteredLibrary = useMemo(() => library.filter(
    (track) =>
      !playlistTrackUris.has(track.uri) &&
      (track.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
       track.artist.toLowerCase().includes(searchQuery.toLowerCase()))
  ), [library, playlistTrackUris, searchQuery]);

  const handleAddTrack = (track: TrackMetadata) => {
    if (onAddTrack) {
      onAddTrack(track);
    }
  };

  const batch = batches.get(playlist.id);

  const downloadableCount = useMemo(
    () => playlist.tracks.filter((t) => t.source === 'navidrome' && t.navidromeId && !OfflineCacheService.isTrackCached(t)).length,
    [playlist.tracks]
  );

  const handleDownloadAll = () => {
    startBatchDownload(playlist.tracks, playlist.name, playlist.id);
  };

  const handleTrackLongPress = (track: TrackMetadata) => {
    setSelectionMode(true);
    setSelectedUris(new Set([track.uri]));
  };

  const renderPlaylistTrack = ({ item, index }: { item: TrackMetadata; index: number }) => {
    const isCurrentTrack = currentTrack?.uri === item.uri;
    const isDragging = draggingIndex === index;
    const isOver = dragOverIndex === index && draggingIndex !== null && draggingIndex !== index;
    const isSelected = selectedUris.has(item.uri);
    const downloadProgress = activeDownloads?.get(item.uri);
    const isCached = item.source === 'navidrome' && OfflineCacheService.isTrackCached(item);

    const trackRow = (
      <Animated.View
        style={[
          styles.trackItemRow,
          { backgroundColor: colors.background },
          isCurrentTrack && !selectionMode && { backgroundColor: colors.card },
          isDragging && { opacity: 0.5, zIndex: 100 },
          isOver && { backgroundColor: colors.accent + '15' },
          isSelected && { backgroundColor: colors.accent + '15' },
        ]}
      >
        <Pressable
          style={styles.trackContent}
          onPress={() => {
            if (selectionMode) {
              setSelectedUris(prev => {
                const next = new Set(prev);
                if (next.has(item.uri)) next.delete(item.uri);
                else next.add(item.uri);
                return next;
              });
            }
          }}
          onLongPress={!selectionMode ? () => handleTrackLongPress(item) : undefined}
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
              <Ionicons
                name={isCached ? 'checkmark-circle' : 'cloud-outline'}
                size={16}
                color={isCached ? colors.success : colors.textSecondary}
              />
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
            <Image source={{ uri: item.artwork }} style={styles.trackArtwork} cachePolicy="memory-disk" />
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
                {downloadProgress < 1 && (
                  <Pressable onPress={() => cancelDownload(item.uri)} hitSlop={4} style={styles.cancelDownloadButton}>
                    <Ionicons name="close-circle" size={18} color={colors.textSecondary} />
                  </Pressable>
                )}
              </View>
            )}
          </View>
        </Pressable>

        {!selectionMode && onReorderTrack && (
          <PanResponderView
            index={index}
            itemCount={playlist.tracks.length}
            itemHeight={itemHeight}
            onDragStart={() => setDraggingIndex(index)}
            onDragMove={(overIndex) => setDragOverIndex(overIndex)}
            onDragEnd={(from, to) => {
              setDraggingIndex(null);
              setDragOverIndex(null);
              if (from !== to) onReorderTrack(from, to);
            }}
            onDragCancel={() => {
              setDraggingIndex(null);
              setDragOverIndex(null);
            }}
          >
            <Ionicons name="reorder-three" size={22} color={colors.textSecondary} />
          </PanResponderView>
        )}
      </Animated.View>
    );

    if (!selectionMode) {
      return (
        <SwipeableRow onDelete={() => onRemoveTrack(item.uri)} onPress={() => onTrackPress(item)}>
          {trackRow}
        </SwipeableRow>
      );
    }
    return trackRow;
  };

  const collageImages = useMemo(() => {
    const images = playlist.tracks.slice(0, 4).map((track) => track.artwork);
    while (images.length < 4) images.push(undefined);
    return images;
  }, [playlist.tracks]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <SafeAreaView style={{ backgroundColor: colors.background }} edges={['top']}>
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <Pressable style={styles.backButton} onPress={onBack}>
            <Ionicons name="chevron-back" size={28} color={colors.accent} />
          </Pressable>
          <View style={styles.headerInfo}>
            {editingName ? (
              <TextInput
                style={[styles.headerTitle, { color: colors.text, backgroundColor: colors.border, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }]}
                value={editNameValue}
                onChangeText={setEditNameValue}
                autoFocus
                onBlur={() => {
                  if (editNameValue.trim() && onRename) {
                    onRename(editNameValue.trim());
                  }
                  setEditingName(false);
                }}
                onSubmitEditing={() => {
                  if (editNameValue.trim() && onRename) {
                    onRename(editNameValue.trim());
                  }
                  setEditingName(false);
                }}
              />
            ) : (
              <Pressable onPress={() => {
                setEditNameValue(playlist.name);
                setEditingName(true);
              }}>
                <Text style={[styles.headerTitle, { color: colors.text }]}>{playlist.name}</Text>
              </Pressable>
            )}
            <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
              {playlist.tracks.length} {playlist.tracks.length === 1 ? 'track' : 'tracks'}
            </Text>
          </View>
          <Animated.View style={{ transform: [{ scale: playButtonScale }] }}>
            <Pressable style={styles.playButton} onPress={handlePlayPress}>
              <Ionicons name="play-circle" size={32} color={colors.accent} />
            </Pressable>
          </Animated.View>
          {onAddTrack && (
            <Pressable style={styles.addButton} onPress={() => setShowAddModal(true)}>
              <Ionicons name="add-circle" size={32} color={colors.accent} />
            </Pressable>
          )}
          {onAddTrack && navidromeConnected && (
            <Pressable style={styles.addButton} onPress={() => setShowNavidromeModal(true)}>
              <Ionicons name="server-outline" size={28} color={colors.success} />
            </Pressable>
          )}
          {batch?.running ? (
            <View style={styles.headerBatchProgress}>
              <View style={[styles.downloadProgressBar, { backgroundColor: colors.border }]}>
                <View style={[styles.downloadProgressFill, {
                  backgroundColor: colors.accent,
                  width: batch.total > 0 ? `${Math.min((batch.completed / batch.total) * 100, 100)}%` : '100%',
                }]} />
              </View>
              <Text style={[styles.downloadProgressText, { color: colors.textSecondary }]} numberOfLines={1}>
                {batch.completed}/{batch.total} downloaded{batch.skipped > 0 ? ` · ${batch.skipped} offline` : ''}
              </Text>
              <Pressable style={styles.addButton} onPress={() => cancelBatch(playlist.id)} hitSlop={8}>
                <Ionicons name="close-circle" size={24} color={colors.danger} />
              </Pressable>
            </View>
          ) : (
            navidromeConnected && downloadableCount > 0 && (
              <Pressable style={styles.addButton} onPress={handleDownloadAll} hitSlop={8}>
                <Ionicons name="cloud-download" size={26} color={colors.accent} />
              </Pressable>
            )
          )}
        </View>
      </SafeAreaView>

      {batch && !batch.running && (
        <View style={[styles.batchBanner, { backgroundColor: batch.cancelled ? colors.card : batch.failed.length > 0 ? colors.danger + '15' : colors.success + '15' }]}>
          <Ionicons
            name={batch.cancelled ? 'information-circle' : batch.failed.length > 0 ? 'alert-circle' : 'checkmark-circle'}
            size={20}
            color={batch.cancelled ? colors.textSecondary : batch.failed.length > 0 ? colors.danger : colors.success}
          />
          <Text
            style={[styles.batchBannerText, { color: batch.cancelled ? colors.text : batch.failed.length > 0 ? colors.danger : colors.success }]}
            numberOfLines={1}
          >
            {batch.cancelled
              ? `Cancelled — ${batch.completed}/${batch.total} downloaded`
              : batch.failed.length > 0
                ? `${batch.completed} downloaded, ${batch.failed.length} failed`
                : batch.skipped === batch.total
                  ? 'Already offline'
                  : `Download complete${batch.skipped > 0 ? ` (${batch.skipped} already offline)` : ''}`}
          </Text>
          {batch.failed.length > 0 && !batch.cancelled && (
            <Pressable onPress={() => retryBatch(playlist.id)} hitSlop={8}>
              <Text style={[styles.selectionAction, { color: colors.accent }]}>Retry</Text>
            </Pressable>
          )}
          <Pressable onPress={() => dismissBatch(playlist.id)} hitSlop={8}>
            <Ionicons name="close" size={18} color={colors.textSecondary} />
          </Pressable>
        </View>
      )}

      {selectionMode && (
        <View style={[styles.selectionHeader, { borderBottomColor: colors.border, backgroundColor: colors.background }]}>
          <Pressable onPress={() => setSelectedUris(new Set(playlist.tracks.map(t => t.uri)))}>
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

      {playlist.tracks.length > 0 && !selectionMode ? (
        <View style={styles.collageContainer}>
          <View style={styles.collageRow}>
            <AnimatedCollageImage artwork={collageImages[0]} index={0} colors={colors} />
            <AnimatedCollageImage artwork={collageImages[1]} index={1} colors={colors} />
          </View>
          <View style={styles.collageRow}>
            <AnimatedCollageImage artwork={collageImages[2]} index={2} colors={colors} />
            <AnimatedCollageImage artwork={collageImages[3]} index={3} colors={colors} />
          </View>
        </View>
      ) : playlist.tracks.length === 0 ? (
        <View style={[styles.emptyCollage, { backgroundColor: colors.card }]}>
          <Ionicons name="musical-notes" size={64} color={colors.textSecondary} />
        </View>
      ) : null}

      {playlist.tracks.length === 0 ? (
        <EmptyState
          icon="list"
          decorativeIcons={[
            { name: 'add-circle-outline', offset: { x: -25, y: -18 }, size: 18, delay: 400 },
            { name: 'musical-notes-outline', offset: { x: 25, y: 18 }, size: 16, delay: 600 },
          ]}
          title="No tracks yet"
          subtitle="Add tracks from your library"
          action={onAddTrack ? { label: 'Add Tracks', onPress: () => setShowAddModal(true), primary: false, icon: 'add-circle' } : undefined}
        />
      ) : (
        <FlatList
          data={playlist.tracks}
          renderItem={renderPlaylistTrack}
          keyExtractor={(item) => item.uri}
          style={styles.list}
          contentContainerStyle={styles.listContent}
          getItemLayout={(_, index) => ({ length: itemHeight, offset: itemHeight * (index ?? 0), index: index ?? 0 })}
        />
      )}

      <Modal
        visible={showAddModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowAddModal(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowAddModal(false)}>
          <Pressable style={[styles.modalContent, { backgroundColor: colors.card }]} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Add Tracks</Text>
              <Pressable onPress={() => setShowAddModal(false)} hitSlop={10}>
                <Ionicons name="close" size={28} color={colors.textSecondary} />
              </Pressable>
            </View>
            <TextInput
              style={[styles.searchInput, { backgroundColor: colors.border, color: colors.text }]}
              placeholder="Search library..."
              placeholderTextColor={colors.textSecondary}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            <View style={[styles.modalListContainer, { borderTopColor: colors.border }]}>
              {filteredLibrary.length === 0 ? (
                <View style={styles.modalEmptyState}>
                  <Ionicons name="musical-notes" size={48} color={colors.textSecondary} />
                  <Text style={[styles.modalEmptyText, { color: colors.textSecondary }]}>
                    {searchQuery ? 'No tracks found' : library.length === 0 ? 'Import tracks in Library first' : 'All tracks already in playlist'}
                  </Text>
                </View>
              ) : (
                <FlatList
                  data={filteredLibrary}
                  keyExtractor={(item) => `add-${item.uri}`}
                  renderItem={({ item }) => (
                    <Pressable
                      style={[styles.libraryTrackItem, { borderBottomColor: colors.border }]}
                      onPress={() => handleAddTrack(item)}
                    >
                      {item.artwork ? (
                        <Image source={{ uri: item.artwork }} style={styles.libraryTrackArtwork} cachePolicy="memory-disk" />
                      ) : (
                        <View style={[styles.libraryTrackArtworkPlaceholder, { backgroundColor: colors.border }]}>
                          <Ionicons name="musical-note" size={24} color={colors.textSecondary} />
                        </View>
                      )}
                      <View style={styles.libraryTrackInfo}>
                        <Text style={[styles.libraryTrackTitle, { color: colors.text }]} numberOfLines={1}>{item.title}</Text>
                        <Text style={[styles.libraryTrackArtist, { color: colors.textSecondary }]} numberOfLines={1}>{item.artist}</Text>
                      </View>
                      <Ionicons name="add-circle" size={24} color={colors.accent} />
                    </Pressable>
                  )}
                />
              )}
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={showNavidromeModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowNavidromeModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.background }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Add from Navidrome</Text>
              <Pressable onPress={() => setShowNavidromeModal(false)} hitSlop={10}>
                <Ionicons name="close" size={28} color={colors.textSecondary} />
              </Pressable>
            </View>
            <NavidromeBrowser mode="addToPlaylist" onAddTracks={(tracks) => {
              tracks.forEach((track) => {
                addTrackToPlaylist(playlist.id, track);
              });
              setShowNavidromeModal(false);
            }} />
          </View>
        </View>
      </Modal>

      {selectedUris.size > 0 && (
        <View style={[styles.batchBar, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
          <Text style={[styles.batchCount, { color: colors.text }]}>{selectedUris.size} selected</Text>
          <View style={styles.batchActions}>
            {onBatchPlaySelected && (
              <Pressable style={styles.batchButton} onPress={() => {
                const tracks = playlist.tracks.filter(t => selectedUris.has(t.uri));
                onBatchPlaySelected(tracks);
                setSelectionMode(false);
                setSelectedUris(new Set());
              }}>
                <Ionicons name="play" size={20} color={colors.accent} />
              </Pressable>
            )}
            {onBatchRemoveFromPlaylist && (
              <Pressable style={styles.batchButton} onPress={() => {
                onBatchRemoveFromPlaylist([...selectedUris]);
                setSelectedUris(new Set());
                setSelectionMode(false);
              }}>
                <Ionicons name="trash" size={20} color="#FF3B30" />
              </Pressable>
            )}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  headerInfo: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  headerSubtitle: {
    fontSize: 14,
  },
  playButton: {
    padding: 8,
  },
  addButton: {
    padding: 8,
  },
  headerBatchProgress: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    maxWidth: 200,
  },
  batchBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  batchBannerText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
  },
  downloadProgressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  downloadProgressBar: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  downloadProgressFill: {
    height: '100%',
    borderRadius: 2,
  },
  downloadProgressText: {
    fontSize: 12,
  },
  cancelDownloadButton: {
    padding: 2,
  },
  collageContainer: {
    alignSelf: 'center',
    width: '80%',
    aspectRatio: 1,
    marginVertical: 20,
    borderRadius: 12,
    overflow: 'hidden',
    gap: 1,
  },
  collageRow: {
    flexDirection: 'row',
    flex: 1,
    gap: 1,
  },
  collageItem: {
    flex: 1,
  },
  collageImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  collagePlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyCollage: {
    aspectRatio: 1,
    margin: 20,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingVertical: 8,
  },
  trackItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  trackContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
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
  trackActions: {
    position: 'absolute',
    right: 8,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    width: 40,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '700',
  },
  searchInput: {
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 16,
  },
  modalListContainer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 8,
    maxHeight: 400,
  },
  libraryTrackItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  libraryTrackArtwork: {
    width: 48,
    height: 48,
    borderRadius: 6,
    marginRight: 12,
  },
  libraryTrackArtworkPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  libraryTrackInfo: {
    flex: 1,
  },
  libraryTrackTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  libraryTrackArtist: {
    fontSize: 14,
  },
  modalEmptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  modalEmptyText: {
    fontSize: 16,
    marginTop: 16,
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
});
