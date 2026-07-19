import React, { useMemo, useRef, useEffect } from 'react';
import { View, StyleSheet, Text, FlatList, Pressable, Image, Animated, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import { TrackMetadata, SmartPlaylist } from '../context/AudioContext';
import { evaluateSmartPlaylist } from '../services/SmartPlaylistEngine';
import { SwipeableRow } from './SwipeableRow';

interface SmartPlaylistDetailProps {
  playlist: SmartPlaylist;
  library: TrackMetadata[];
  currentTrack: TrackMetadata | null;
  onTrackPress: (track: TrackMetadata) => void;
  onRemoveTrack: (trackUri: string) => void;
  onBack: () => void;
  onDelete: () => void;
}

const AnimatedTrackItem = React.memo(function AnimatedTrackItem({ item, index, isCurrentTrack, colors, onPress }: {
  item: TrackMetadata;
  index: number;
  isCurrentTrack: boolean;
  colors: any;
  onPress: (item: TrackMetadata) => void;
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
});

function RuleSummary({ rules }: { rules: SmartPlaylist['rules'] }) {
  const { colors } = useTheme();
  return (
    <View style={styles.ruleSummary}>
      {rules.map((rule, i) => {
        let label = '';
        switch (rule.field) {
          case 'playCount':
            label = `Play count ${rule.op === 'gte' ? '≥' : rule.op === 'lte' ? '≤' : '='} ${rule.value}`;
            break;
          case 'isFavorite':
            label = rule.value ? 'Is favorite' : 'Not favorite';
            break;
          case 'artist':
            label = `Artist: ${rule.value}`;
            break;
          case 'album':
            label = `Album: ${rule.value}`;
            break;
          case 'source':
            label = `Source: ${rule.value}`;
            break;
        }
        return (
          <View key={i} style={[styles.ruleChip, { backgroundColor: colors.card }]}>
            <Text style={[styles.ruleChipText, { color: colors.textSecondary }]}>{label}</Text>
          </View>
        );
      })}
    </View>
  );
}

export function SmartPlaylistDetail({
  playlist,
  library,
  currentTrack,
  onTrackPress,
  onRemoveTrack,
  onBack,
  onDelete,
}: SmartPlaylistDetailProps) {
  const { colors } = useTheme();

  const tracks = useMemo(() => evaluateSmartPlaylist(library, playlist), [library, playlist]);

  const handleLongPress = () => {
    Alert.alert(playlist.name, 'Delete this smart playlist?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: onDelete },
    ]);
  };

  const renderTrack = ({ item, index }: { item: TrackMetadata; index: number }) => {
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
              {tracks.length} {tracks.length === 1 ? 'track' : 'tracks'}
            </Text>
          </View>
          <Pressable style={styles.deleteButton} onPress={handleLongPress}>
            <Ionicons name="trash-outline" size={24} color="#FF3B30" />
          </Pressable>
        </View>
      </SafeAreaView>

      <RuleSummary rules={playlist.rules} />

      {tracks.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="musical-notes" size={64} color={colors.textSecondary} />
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No matching tracks</Text>
          <Text style={[styles.emptySubtext, { color: colors.textSecondary }]}>Try adjusting your library or rules</Text>
        </View>
      ) : (
        <FlatList
          data={tracks}
          renderItem={renderTrack}
          keyExtractor={(item) => item.uri}
          style={styles.list}
          contentContainerStyle={styles.listContent}
          getItemLayout={(_, index) => ({ length: 72, offset: 72 * (index ?? 0), index: index ?? 0 })}
        />
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
  deleteButton: {
    padding: 8,
  },
  ruleSummary: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 8,
  },
  ruleChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  ruleChipText: {
    fontSize: 13,
    fontWeight: '500',
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
});
