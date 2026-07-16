import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, Text, FlatList, Pressable, Image, Modal, TextInput, Animated, Easing } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import { TrackMetadata, Playlist } from '../context/AudioContext';
import { SwipeableRow } from './SwipeableRow';

interface PlaylistDetailProps {
  playlist: Playlist;
  currentTrack: TrackMetadata | null;
  onTrackPress: (track: TrackMetadata) => void;
  onRemoveTrack: (trackUri: string) => void;
  onPlayPlaylist: () => void;
  onBack: () => void;
  onAddTrack?: (track: TrackMetadata) => void;
  library?: TrackMetadata[];
}

function AnimatedTrackItem({ item, index, isCurrentTrack, colors, onPress }: {
  item: TrackMetadata;
  index: number;
  isCurrentTrack: boolean;
  colors: any;
  onPress: () => void;
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

  return (
    <Animated.View style={{ opacity, transform: [{ translateY }, { scale: pressScale }] }}>
      <Pressable
        style={[styles.trackItem, { backgroundColor: colors.background }, isCurrentTrack && { backgroundColor: colors.card }]}
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
      >
        <View style={styles.trackNumber}>
          <Text style={[styles.trackNumberText, { color: colors.textSecondary }, isCurrentTrack && { color: colors.accent }]}>
            {isCurrentTrack ? (
              <Ionicons name="musical-notes" size={16} color={colors.accent} />
            ) : (
              index + 1
            )}
          </Text>
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
            style={[styles.trackTitle, { color: colors.text }, isCurrentTrack && { color: colors.accent }]}
            numberOfLines={1}
          >
            {item.title}
          </Text>
          <Text style={[styles.trackArtist, { color: colors.textSecondary }]} numberOfLines={1}>
            {item.artist}
          </Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}

function AnimatedCollageImage({ artwork, index, colors }: { artwork: string | undefined; index: number; colors: any }) {
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(opacity, { toValue: 1, duration: 400, delay: index * 100, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, []);

  return (
    <Animated.View style={[styles.collageItem, { width: '50%', height: '50%', opacity }]}>
      {artwork ? (
        <Image source={{ uri: artwork }} style={styles.collageImage} />
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
  onPlayPlaylist,
  onBack,
  onAddTrack,
  library = [],
}: PlaylistDetailProps) {
  const { colors } = useTheme();
  const [showAddModal, setShowAddModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const playButtonScale = useRef(new Animated.Value(1)).current;

  const handlePlayPress = () => {
    Animated.sequence([
      Animated.spring(playButtonScale, { toValue: 0.85, useNativeDriver: true, damping: 10, stiffness: 300 }),
      Animated.spring(playButtonScale, { toValue: 1, useNativeDriver: true, damping: 10, stiffness: 200 }),
    ]).start();
    onPlayPlaylist();
  };

  const playlistTrackUris = new Set(playlist.tracks.map((t) => t.uri));

  const filteredLibrary = library.filter(
    (track) =>
      !playlistTrackUris.has(track.uri) &&
      (track.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
       track.artist.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const handleAddTrack = (track: TrackMetadata) => {
    if (onAddTrack) {
      onAddTrack(track);
    }
  };

  const renderPlaylistTrack = ({ item, index }: { item: TrackMetadata; index: number }) => {
    const isCurrentTrack = currentTrack?.uri === item.uri;

    return (
      <SwipeableRow onDelete={() => onRemoveTrack(item.uri)}>
        <AnimatedTrackItem
          item={item}
          index={index}
          isCurrentTrack={isCurrentTrack}
          colors={colors}
          onPress={() => onTrackPress(item)}
        />
      </SwipeableRow>
    );
  };

  const getCollageImages = () => {
    return playlist.tracks.slice(0, 4).map((track) => track.artwork);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <SafeAreaView style={{ backgroundColor: colors.background }} edges={['top']}>
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <Pressable style={styles.backButton} onPress={onBack}>
            <Ionicons name="chevron-back" size={28} color={colors.accent} />
          </Pressable>
          <View style={styles.headerInfo}>
            <Text style={[styles.headerTitle, { color: colors.text }]}>{playlist.name}</Text>
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
        </View>
      </SafeAreaView>

      {playlist.tracks.length > 0 ? (
        <View style={styles.collageContainer}>
          {getCollageImages().map((artwork, index) => (
            <AnimatedCollageImage key={index} artwork={artwork} index={index} colors={colors} />
          ))}
        </View>
      ) : (
        <View style={[styles.emptyCollage, { backgroundColor: colors.card }]}>
          <Ionicons name="musical-notes" size={64} color={colors.textSecondary} />
        </View>
      )}

      {playlist.tracks.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="list" size={64} color={colors.textSecondary} />
          <Text style={[styles.emptyText, { color: colors.text }]}>No tracks yet</Text>
          <Text style={[styles.emptySubtext, { color: colors.textSecondary }]}>Add tracks from your library</Text>
          {onAddTrack && (
            <Pressable style={[styles.emptyAddButton, { backgroundColor: colors.card }]} onPress={() => setShowAddModal(true)}>
              <Ionicons name="add-circle" size={24} color={colors.accent} />
              <Text style={[styles.emptyAddButtonText, { color: colors.accent }]}>Add Tracks</Text>
            </Pressable>
          )}
        </View>
      ) : (
        <FlatList
          data={playlist.tracks}
          renderItem={renderPlaylistTrack}
          keyExtractor={(item) => item.uri}
          style={styles.list}
          contentContainerStyle={styles.listContent}
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
                        <Image source={{ uri: item.artwork }} style={styles.libraryTrackArtwork} />
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
  collageContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: '100%',
    aspectRatio: 1,
    margin: 20,
    borderRadius: 12,
    overflow: 'hidden',
  },
  collageItem: {
    borderWidth: 0.5,
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
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: '600',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 16,
    marginTop: 8,
  },
  emptyAddButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  emptyAddButtonText: {
    fontSize: 16,
    fontWeight: '600',
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
});
