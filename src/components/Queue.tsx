import React, { useState, useEffect, useRef, useMemo } from 'react';
import { View, StyleSheet, Text, FlatList, Pressable, Animated, TextInput, Modal } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import { useAudio, TrackMetadata } from '../context/AudioContext';
import { SwipeableRow } from './SwipeableRow';
import { EmptyState } from './EmptyState';
import { PanResponderView } from './PanResponderView';

const ITEM_HEIGHT = 68;

const QueueTrackItem = React.memo(function QueueTrackItem({
  item,
  index,
  isDragging,
  isOver,
  colors,
  queueLength,
  onPress,
  onDelete,
  onDragStart,
  onDragMove,
  onDragEnd,
  onDragCancel,
  selectionMode,
  isSelected,
  onToggleSelection,
}: {
  item: TrackMetadata;
  index: number;
  isDragging: boolean;
  isOver: boolean;
  colors: any;
  queueLength: number;
  onPress: (item: TrackMetadata) => void;
  onDelete: (index: number) => void;
  onDragStart: (index: number) => void;
  onDragMove: (overIndex: number) => void;
  onDragEnd: (from: number, to: number) => void;
  onDragCancel: () => void;
  selectionMode?: boolean;
  isSelected?: boolean;
  onToggleSelection?: () => void;
}) {
  return (
    <SwipeableRow onDelete={() => onDelete(index)} onPress={!selectionMode ? () => onPress(item) : undefined}>
      <Animated.View
        style={[
          styles.trackItemRow,
          { backgroundColor: colors.background },
          isDragging && { opacity: 0.5, zIndex: 100 },
          isOver && { backgroundColor: colors.accent + '15' },
          isSelected && { backgroundColor: colors.accent + '15' },
        ]}
      >
        <Pressable
          style={styles.trackContent}
          onPress={() => {
            if (selectionMode && onToggleSelection) {
              onToggleSelection();
            }
          }}
        >
          {selectionMode ? (
            <Ionicons
              name={isSelected ? 'checkmark-circle' : 'ellipse-outline'}
              size={22}
              color={isSelected ? colors.accent : colors.textSecondary}
              style={{ marginRight: 8 }}
            />
          ) : (
            <Text style={[styles.trackNumber, { color: colors.textSecondary }]}>{index + 1}</Text>
          )}
          {item.artwork ? (
            <Image source={{ uri: item.artwork }} style={styles.artwork} cachePolicy="memory-disk" />
          ) : (
            <View style={[styles.artworkPlaceholder, { backgroundColor: colors.border }]}>
              <Ionicons name="musical-note" size={18} color={colors.textSecondary} />
            </View>
          )}
          <View style={styles.trackInfo}>
            <Text style={[styles.trackTitle, { color: colors.text }]} numberOfLines={1}>{item.title}</Text>
            <Text style={[styles.trackArtist, { color: colors.textSecondary }]} numberOfLines={1}>{item.artist}</Text>
          </View>
        </Pressable>
        {!selectionMode && (
          <PanResponderView
            index={index}
            itemCount={queueLength}
            onDragStart={() => onDragStart(index)}
            onDragMove={onDragMove}
            onDragEnd={onDragEnd}
            onDragCancel={onDragCancel}
          >
            <Ionicons name="reorder-three" size={22} color={colors.textSecondary} />
          </PanResponderView>
        )}
      </Animated.View>
    </SwipeableRow>
  );
});

interface QueueProps {
  onClose: () => void;
}

export function Queue({ onClose }: QueueProps) {
  const { colors } = useTheme();
  const { currentTrack, queue, removeFromQueue, reorderQueue, shuffleQueue, addToQueue, loadTrack, library } = useAudio();
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());

  const handlePlayTrack = (track: TrackMetadata) => {
    loadTrack(track.uri, track, true);
  };

  const filteredLibrary = useMemo(() => library.filter(
    (track) =>
      !queue.some((q) => q.uri === track.uri) &&
      track.uri !== currentTrack?.uri &&
      (track.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
       track.artist.toLowerCase().includes(searchQuery.toLowerCase()))
  ), [library, queue, currentTrack, searchQuery]);

  const handleTrackLongPress = (index: number) => {
    setSelectionMode(true);
    setSelectedIndices(new Set([index]));
  };

  const renderQueueTrack = ({ item, index }: { item: TrackMetadata; index: number }) => {
    const isDragging = draggingIndex === index;
    const isOver = dragOverIndex === index && draggingIndex !== null && draggingIndex !== index;
    const isSelected = selectedIndices.has(index);

    return (
      <QueueTrackItem
        item={item}
        index={index}
        isDragging={isDragging}
        isOver={isOver}
        colors={colors}
        queueLength={queue.length}
        onPress={handlePlayTrack}
        onDelete={removeFromQueue}
        onDragStart={setDraggingIndex}
        onDragMove={setDragOverIndex}
        onDragEnd={(from, to) => {
          setDraggingIndex(null);
          setDragOverIndex(null);
          if (from !== to) reorderQueue(from, to);
        }}
        onDragCancel={() => {
          setDraggingIndex(null);
          setDragOverIndex(null);
        }}
        selectionMode={selectionMode}
        isSelected={isSelected}
        onToggleSelection={selectionMode ? () => {
          setSelectedIndices(prev => {
            const next = new Set(prev);
            if (next.has(index)) next.delete(index);
            else next.add(index);
            return next;
          });
        } : undefined}
      />
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <SafeAreaView style={{ backgroundColor: colors.background }} edges={['top']}>
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          {selectionMode ? (
            <Pressable onPress={() => { setSelectionMode(false); setSelectedIndices(new Set()); }} hitSlop={10} style={styles.headerButton}>
              <Text style={{ color: colors.accent, fontSize: 16, fontWeight: '600' }}>Done</Text>
            </Pressable>
          ) : (
            <Pressable onPress={onClose} hitSlop={10} style={styles.headerButton}>
              <Ionicons name="close" size={28} color={colors.textSecondary} />
            </Pressable>
          )}
          <View style={styles.headerCenter}>
            <Text style={[styles.headerTitle, { color: colors.text }]}>Queue</Text>
            {queue.length > 0 && (
              <Text style={[styles.trackCount, { color: colors.textSecondary }]}>
                {queue.length} {queue.length === 1 ? 'track' : 'tracks'}
              </Text>
            )}
          </View>
          <View style={styles.headerActions}>
            {!selectionMode && (
              <>
                <Pressable onPress={() => setShowAddModal(true)} hitSlop={10} style={styles.headerButton}>
                  <Ionicons name="add-circle" size={26} color={colors.accent} />
                </Pressable>
                {queue.length > 0 && (
                  <Pressable onPress={() => shuffleQueue()} hitSlop={10} style={styles.headerButton}>
                    <Ionicons name="shuffle" size={22} color={colors.textSecondary} />
                  </Pressable>
                )}
              </>
            )}
            {selectionMode && selectedIndices.size > 0 && (
              <Pressable onPress={() => {
                const sortedIndices = [...selectedIndices].sort((a, b) => b - a);
                sortedIndices.forEach(i => removeFromQueue(i));
                setSelectedIndices(new Set());
                setSelectionMode(false);
              }} hitSlop={10} style={styles.headerButton}>
                <Ionicons name="trash" size={22} color="#FF3B30" />
              </Pressable>
            )}
          </View>
        </View>
      </SafeAreaView>

      {currentTrack && !selectionMode && (
        <View style={[styles.section, { borderBottomColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Now Playing</Text>
          <View style={[styles.nowPlaying, { backgroundColor: colors.card }]}>
            {currentTrack.artwork ? (
              <Image source={{ uri: currentTrack.artwork }} style={styles.nowPlayingArt} cachePolicy="memory-disk" />
            ) : (
              <View style={[styles.nowPlayingArtPlaceholder, { backgroundColor: colors.border }]}>
                <Ionicons name="musical-note" size={22} color={colors.textSecondary} />
              </View>
            )}
            <View style={styles.nowPlayingInfo}>
              <Text style={[styles.nowPlayingTitle, { color: colors.text }]} numberOfLines={1}>{currentTrack.title}</Text>
              <Text style={[styles.nowPlayingArtist, { color: colors.textSecondary }]} numberOfLines={1}>{currentTrack.artist}</Text>
            </View>
            <Ionicons name="play" size={18} color={colors.accent} />
          </View>
        </View>
      )}

      {selectionMode && (
        <View style={[styles.selectionHeader, { borderBottomColor: colors.border, backgroundColor: colors.background }]}>
          <Pressable onPress={() => setSelectedIndices(new Set(queue.map((_, i) => i)))}>
            <Text style={[styles.selectionAction, { color: colors.accent }]}>All</Text>
          </Pressable>
          <Pressable onPress={() => setSelectedIndices(new Set())}>
            <Text style={[styles.selectionAction, { color: colors.textSecondary }]}>None</Text>
          </Pressable>
        </View>
      )}

      <View style={styles.queueSection}>
        <View style={styles.queueSectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Up Next</Text>
        </View>
        {queue.length === 0 ? (
          <EmptyState
            icon="reorder-two"
            decorativeIcons={[
              { name: 'add-circle-outline', offset: { x: 25, y: -20 }, size: 18, delay: 400 },
            ]}
            title="No tracks in queue"
            subtitle="Add tracks to play them next"
            action={{ label: 'Add Tracks', onPress: () => setShowAddModal(true), primary: true, icon: 'add' }}
          />
        ) : (
          <FlatList
            data={queue}
            keyExtractor={(item, index) => `queue-${item.uri}-${index}`}
            renderItem={renderQueueTrack}
            contentContainerStyle={styles.listContent}
            getItemLayout={(_, index) => ({ length: ITEM_HEIGHT, offset: ITEM_HEIGHT * (index ?? 0), index: index ?? 0 })}
            removeClippedSubviews={true}
            maxToRenderPerBatch={10}
            windowSize={11}
          />
        )}
      </View>

      <Modal
        visible={showAddModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowAddModal(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowAddModal(false)}>
          <Pressable style={[styles.modalContent, { backgroundColor: colors.card }]} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Add to Queue</Text>
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
                    {searchQuery ? 'No tracks found' : library.length === 0 ? 'Import tracks in Library first' : 'All tracks in queue'}
                  </Text>
                </View>
              ) : (
                <FlatList
                  data={filteredLibrary}
                  keyExtractor={(item) => `add-${item.uri}`}
                  removeClippedSubviews={true}
                  maxToRenderPerBatch={10}
                  windowSize={5}
                  renderItem={({ item }) => (
                    <Pressable
                      style={[styles.libraryTrackItem, { borderBottomColor: colors.border }]}
                      onPress={() => {
                        addToQueue(item);
                        setShowAddModal(false);
                      }}
                    >
                      {item.artwork ? (
                        <Image source={{ uri: item.artwork }} style={styles.libraryTrackArtwork} cachePolicy="memory-disk" />
                      ) : (
                        <View style={[styles.libraryTrackArtworkPlaceholder, { backgroundColor: colors.border }]}>
                          <Ionicons name="musical-note" size={20} color={colors.textSecondary} />
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
  headerButton: {
    padding: 8,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  trackCount: {
    fontSize: 13,
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
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
  section: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  nowPlaying: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 10,
    marginTop: 10,
  },
  nowPlayingArt: {
    width: 44,
    height: 44,
    borderRadius: 8,
    marginRight: 12,
  },
  nowPlayingArtPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  nowPlayingInfo: {
    flex: 1,
    marginRight: 12,
  },
  nowPlayingTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 2,
  },
  nowPlayingArtist: {
    fontSize: 13,
  },
  queueSection: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  queueSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  listContent: {
    paddingBottom: 40,
  },
  trackItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 4,
  },
  trackContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  trackNumber: {
    width: 24,
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
    marginRight: 8,
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
  trackInfo: {
    flex: 1,
    marginRight: 12,
  },
  trackTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 2,
  },
  trackArtist: {
    fontSize: 13,
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
    maxHeight: '70%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 22,
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
    width: 44,
    height: 44,
    borderRadius: 6,
    marginRight: 12,
  },
  libraryTrackArtworkPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  libraryTrackInfo: {
    flex: 1,
  },
  libraryTrackTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 2,
  },
  libraryTrackArtist: {
    fontSize: 13,
  },
  modalEmptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  modalEmptyText: {
    fontSize: 16,
    marginTop: 12,
  },
});
