import React, { useEffect, useRef, useState, useMemo } from 'react';
import { View, StyleSheet, Text, FlatList, Pressable, Image, Animated, TextInput, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import { useAudio, TrackMetadata } from '../context/AudioContext';
import { SwipeableRow } from './SwipeableRow';
import { NavidromeBrowser } from './NavidromeBrowser';
import { EmptyState } from './EmptyState';

type FilterMode = 'all' | 'favorites';
type SortMode = 'title' | 'playCount';

interface TrackListProps {
  tracks: TrackMetadata[];
  currentTrack: TrackMetadata | null;
  onTrackPress: (track: TrackMetadata) => void;
  onAddTracks: () => void;
  onTrackLongPress?: (track: TrackMetadata) => void;
  onRemoveTrack?: (trackUri: string) => void;
  onToggleFavorite?: (uri: string) => void;
}

const AnimatedTrackItem = React.memo(function AnimatedTrackItem({ item, index, isCurrentTrack, colors, onPress, onLongPress, onToggleFavorite }: {
  item: TrackMetadata;
  index: number;
  isCurrentTrack: boolean;
  colors: any;
  onPress: (item: TrackMetadata) => void;
  onLongPress?: (item: TrackMetadata) => void;
  onToggleFavorite?: (uri: string) => void;
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
        onPress={() => onPress(item)}
        onLongPress={onLongPress ? () => onLongPress(item) : undefined}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
      >
        <View style={styles.trackNumber}>
          {item.source === 'navidrome' ? (
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
            style={[styles.trackTitle, { color: colors.text }, isCurrentTrack && { color: colors.accent }]}
            numberOfLines={1}
          >
            {item.title}
          </Text>
          <Text style={[styles.trackArtist, { color: colors.textSecondary }]} numberOfLines={1}>
            {item.artist}
          </Text>
        </View>

        {isCurrentTrack && (
          <Ionicons name="play" size={20} color={colors.accent} />
        )}
        {onToggleFavorite && (
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

export function TrackList({ tracks, currentTrack, onTrackPress, onAddTracks, onTrackLongPress, onRemoveTrack, onToggleFavorite }: TrackListProps) {
  const { colors } = useTheme();
  const { navidromeConnected, addToLibrary } = useAudio();
  const [searchQuery, setSearchQuery] = useState('');
  const [showNavidrome, setShowNavidrome] = useState(false);
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const [sortMode, setSortMode] = useState<SortMode>('title');

  const filteredTracks = useMemo(() => {
    let result = tracks;

    if (filterMode === 'favorites') {
      result = result.filter((t) => t.isFavorite);
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
  }, [tracks, searchQuery, filterMode, sortMode]);

  const renderTrack = ({ item, index }: { item: TrackMetadata; index: number }) => {
    const isCurrentTrack = currentTrack?.uri === item.uri;

    const trackContent = (
      <AnimatedTrackItem
        item={item}
        index={index}
        isCurrentTrack={isCurrentTrack}
        colors={colors}
        onPress={onTrackPress}
        onLongPress={onTrackLongPress}
        onToggleFavorite={onToggleFavorite}
      />
    );

    if (onRemoveTrack) {
      return (
        <SwipeableRow onDelete={() => onRemoveTrack(item.uri)}>
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

      {tracks.length > 0 && (
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

      {tracks.length > 0 && (
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
          keyExtractor={(item) => item.uri}
          style={styles.list}
          contentContainerStyle={styles.listContent}
        />
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
