import React, { useRef, useEffect } from 'react';
import { View, StyleSheet, Text, FlatList, Pressable, Image, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useAudio, TrackMetadata } from '../context/AudioContext';
import { SwipeableRow } from './SwipeableRow';

function QueueTrackItem({ item, index, colors, onPress }: {
  item: TrackMetadata;
  index: number;
  colors: any;
  onPress: () => void;
}) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(15)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 250, delay: index * 40, useNativeDriver: true }),
      Animated.spring(translateY, { toValue: 0, useNativeDriver: true, damping: 15, stiffness: 100, delay: index * 40 }),
    ]).start();
  }, []);

  return (
    <Animated.View style={{ opacity, transform: [{ translateY }] }}>
      <Pressable
        style={[styles.trackItem, { backgroundColor: 'transparent' }]}
        onPress={onPress}
      >
        <Text style={[styles.trackNumber, { color: colors.textSecondary }]}>{index + 1}</Text>
        {item.artwork ? (
          <Image source={{ uri: item.artwork }} style={styles.artwork} />
        ) : (
          <View style={[styles.artworkPlaceholder, { backgroundColor: colors.border }]}>
            <Ionicons name="musical-note" size={18} color={colors.textSecondary} />
          </View>
        )}
        <View style={styles.trackInfo}>
          <Text style={[styles.trackTitle, { color: colors.text }]} numberOfLines={1}>{item.title}</Text>
          <Text style={[styles.trackArtist, { color: colors.textSecondary }]} numberOfLines={1}>{item.artist}</Text>
        </View>
        <Ionicons name="play-circle-outline" size={22} color={colors.textSecondary} />
      </Pressable>
    </Animated.View>
  );
}

export function Queue() {
  const { colors } = useTheme();
  const { currentTrack, queue, removeFromQueue, loadTrack, play } = useAudio();

  const handlePlayTrack = (track: TrackMetadata) => {
    loadTrack(track.uri, track).then(() => play());
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Up Next</Text>
        {queue.length > 0 && (
          <Text style={[styles.trackCount, { color: colors.textSecondary }]}>
            {queue.length} {queue.length === 1 ? 'track' : 'tracks'}
          </Text>
        )}
      </View>

      {currentTrack && (
        <View style={[styles.section, { borderBottomColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Now Playing</Text>
          <View style={[styles.nowPlaying, { backgroundColor: colors.card }]}>
            {currentTrack.artwork ? (
              <Image source={{ uri: currentTrack.artwork }} style={styles.nowPlayingArt} />
            ) : (
              <View style={[styles.nowPlayingArtPlaceholder, { backgroundColor: colors.border }]}>
                <Ionicons name="musical-note" size={24} color={colors.textSecondary} />
              </View>
            )}
            <View style={styles.nowPlayingInfo}>
              <Text style={[styles.nowPlayingTitle, { color: colors.text }]} numberOfLines={1}>{currentTrack.title}</Text>
              <Text style={[styles.nowPlayingArtist, { color: colors.textSecondary }]} numberOfLines={1}>{currentTrack.artist}</Text>
            </View>
            <Ionicons name="play" size={20} color={colors.accent} />
          </View>
        </View>
      )}

      <View style={styles.queueSection}>
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Up Next</Text>
        {queue.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="list" size={48} color={colors.textSecondary} />
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No tracks in queue</Text>
          </View>
        ) : (
          <FlatList
            data={queue}
            keyExtractor={(item, index) => `queue-${item.uri}-${index}`}
            renderItem={({ item, index }) => (
              <SwipeableRow onDelete={() => removeFromQueue(index)}>
                <QueueTrackItem
                  item={item}
                  index={index}
                  colors={colors}
                  onPress={() => handlePlayTrack(item)}
                />
              </SwipeableRow>
            )}
            contentContainerStyle={styles.listContent}
          />
        )}
      </View>
    </View>
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
    fontSize: 28,
    fontWeight: '700',
  },
  trackCount: {
    fontSize: 14,
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
    marginBottom: 10,
  },
  nowPlaying: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 10,
  },
  nowPlayingArt: {
    width: 48,
    height: 48,
    borderRadius: 8,
    marginRight: 12,
  },
  nowPlayingArtPlaceholder: {
    width: 48,
    height: 48,
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
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  nowPlayingArtist: {
    fontSize: 14,
  },
  queueSection: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  listContent: {
    paddingBottom: 40,
  },
  trackItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 4,
  },
  trackNumber: {
    width: 28,
    fontSize: 14,
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
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 16,
    marginTop: 12,
  },
});
