import React, { useMemo, useRef, useEffect, useState } from 'react';
import { View, StyleSheet, Text, FlatList, Pressable, Image, Animated, Alert, Modal, TextInput, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import { useAudio, TrackMetadata, SmartPlaylist, SmartPlaylistRule } from '../context/AudioContext';
import { evaluateSmartPlaylist } from '../services/SmartPlaylistEngine';
import { SwipeableRow } from './SwipeableRow';
import { OfflineCacheService } from '../services/OfflineCacheService';

interface SmartPlaylistDetailProps {
  playlist: SmartPlaylist;
  library: TrackMetadata[];
  currentTrack: TrackMetadata | null;
  onTrackPress: (track: TrackMetadata) => void;
  onRemoveTrack: (trackUri: string) => void;
  onBack: () => void;
  onDelete: () => void;
  onUpdate?: (id: string, updates: Partial<Omit<SmartPlaylist, 'id' | 'createdAt'>>) => void;
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

        {item.source === 'navidrome' && !OfflineCacheService.isTrackCached(item) && (
          <Ionicons name="cloud-download-outline" size={18} color={colors.textSecondary} />
        )}
      </Pressable>
    </Animated.View>
  );
});

function RuleSummary({ rules, onRemoveRule }: { rules: SmartPlaylist['rules']; onRemoveRule?: (index: number) => void }) {
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
          <Pressable
            key={i}
            style={[styles.ruleChip, { backgroundColor: colors.card }]}
            onPress={onRemoveRule ? () => onRemoveRule(i) : undefined}
          >
            <Text style={[styles.ruleChipText, { color: colors.textSecondary }]}>{label}</Text>
            {onRemoveRule && <Ionicons name="close-circle" size={14} color={colors.textSecondary} style={{ marginLeft: 4 }} />}
          </Pressable>
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
  onUpdate,
}: SmartPlaylistDetailProps) {
  const { colors } = useTheme();
  const { getNavidromeCredentials } = useAudio();
  const [showEditModal, setShowEditModal] = useState(false);
  const [editName, setEditName] = useState(playlist.name);
  const [editRules, setEditRules] = useState<SmartPlaylistRule[]>(playlist.rules);
  const [editLimit, setEditLimit] = useState(String(playlist.limit ?? 50));
  const [editSortField, setEditSortField] = useState<'playCount' | 'title'>(playlist.sortField ?? 'title');

  const tracks = useMemo(() => evaluateSmartPlaylist(library, playlist), [library, playlist]);

  const handleDelete = () => {
    Alert.alert(playlist.name, 'Delete this smart playlist?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: onDelete },
    ]);
  };

  const handleRemoveRule = (index: number) => {
    const newRules = editRules.filter((_, i) => i !== index);
    setEditRules(newRules);
  };

  const handleSaveEdit = () => {
    if (onUpdate && editName.trim()) {
      onUpdate(playlist.id, {
        name: editName.trim(),
        rules: editRules,
        limit: parseInt(editLimit, 10) || 50,
        sortField: editSortField,
      });
    }
    setShowEditModal(false);
  };

  const openEditModal = () => {
    setEditName(playlist.name);
    setEditRules([...playlist.rules]);
    setEditLimit(String(playlist.limit ?? 50));
    setEditSortField(playlist.sortField ?? 'title');
    setShowEditModal(true);
  };

  const isTrackDownloadable = (track: TrackMetadata) => {
    return track.source === 'navidrome' && !OfflineCacheService.isTrackCached(track);
  };

  const handleTrackDownload = (track: TrackMetadata) => {
    if (isTrackDownloadable(track)) {
      const creds = getNavidromeCredentials();
      if (creds) {
        OfflineCacheService.downloadTrackForOffline(creds, track).catch(() => {});
      }
    }
  };

  const renderTrack = ({ item, index }: { item: TrackMetadata; index: number }) => {
    const isCurrentTrack = currentTrack?.uri === item.uri;
    return (
      <SwipeableRow
        onDelete={() => {
          Alert.alert('Remove from Library', `Remove "${item.title}" from your library?`, [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Remove', style: 'destructive', onPress: () => onRemoveTrack(item.uri) },
          ]);
        }}
        onDownload={isTrackDownloadable(item) ? () => handleTrackDownload(item) : undefined}
      >
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
          {onUpdate && (
            <Pressable style={styles.editButton} onPress={openEditModal}>
              <Ionicons name="pencil" size={22} color={colors.accent} />
            </Pressable>
          )}
          <Pressable style={styles.deleteButton} onPress={handleDelete}>
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
          removeClippedSubviews
        />
      )}

      <Modal visible={showEditModal} animationType="slide" transparent onRequestClose={() => setShowEditModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Edit Smart Playlist</Text>
              <Pressable onPress={() => setShowEditModal(false)} hitSlop={10}>
                <Ionicons name="close" size={28} color={colors.textSecondary} />
              </Pressable>
            </View>

            <ScrollView style={styles.modalScroll}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>Name</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                value={editName}
                onChangeText={setEditName}
                placeholder="Playlist name"
                placeholderTextColor={colors.textSecondary}
              />

              <Text style={[styles.label, { color: colors.textSecondary }]}>Rules</Text>
              {editRules.map((rule, i) => {
                let label = '';
                switch (rule.field) {
                  case 'playCount': label = `Play count ${rule.op === 'gte' ? '≥' : rule.op === 'lte' ? '≤' : '='} ${rule.value}`; break;
                  case 'isFavorite': label = rule.value ? 'Is favorite' : 'Not favorite'; break;
                  case 'artist': label = `Artist: ${rule.value}`; break;
                  case 'album': label = `Album: ${rule.value}`; break;
                  case 'source': label = `Source: ${rule.value}`; break;
                }
                return (
                  <Pressable key={i} style={[styles.editRuleChip, { backgroundColor: colors.background, borderColor: colors.border }]} onPress={() => handleRemoveRule(i)}>
                    <Text style={[styles.editRuleText, { color: colors.text }]}>{label}</Text>
                    <Ionicons name="close-circle" size={18} color="#FF3B30" />
                  </Pressable>
                );
              })}
              {editRules.length === 0 && (
                <Text style={[styles.noRules, { color: colors.textSecondary }]}>No rules added yet</Text>
              )}

              <Text style={[styles.label, { color: colors.textSecondary }]}>Sort by</Text>
              <View style={styles.sortRow}>
                {(['title', 'playCount'] as const).map((field) => (
                  <Pressable
                    key={field}
                    style={[styles.sortOption, { backgroundColor: editSortField === field ? colors.accent : colors.background, borderColor: colors.border }]}
                    onPress={() => setEditSortField(field)}
                  >
                    <Text style={{ color: editSortField === field ? '#fff' : colors.text, fontWeight: '600' }}>
                      {field === 'title' ? 'Title' : 'Plays'}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <Text style={[styles.label, { color: colors.textSecondary }]}>Limit</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                value={editLimit}
                onChangeText={setEditLimit}
                keyboardType="number-pad"
                placeholder="50"
                placeholderTextColor={colors.textSecondary}
              />
            </ScrollView>

            <View style={[styles.modalFooter, { borderTopColor: colors.border }]}>
              <Pressable style={[styles.cancelButton, { borderColor: colors.border }]} onPress={() => setShowEditModal(false)}>
                <Text style={{ color: colors.text }}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.saveButton, { backgroundColor: colors.accent, opacity: editName.trim() && editRules.length > 0 ? 1 : 0.5 }]}
                onPress={handleSaveEdit}
                disabled={!editName.trim() || editRules.length === 0}
              >
                <Text style={{ color: '#fff', fontWeight: '600' }}>Save</Text>
              </Pressable>
            </View>
          </View>
        </View>
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
  editButton: {
    padding: 8,
    marginRight: 4,
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
    flexDirection: 'row',
    alignItems: 'center',
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxHeight: '80%',
    borderRadius: 16,
    overflow: 'hidden',
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
    fontSize: 20,
    fontWeight: '700',
  },
  modalScroll: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
    marginTop: 16,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 16,
  },
  editRuleChip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 8,
  },
  editRuleText: {
    fontSize: 15,
    flex: 1,
  },
  noRules: {
    fontSize: 14,
    fontStyle: 'italic',
    marginBottom: 8,
  },
  sortRow: {
    flexDirection: 'row',
    gap: 8,
  },
  sortOption: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
  },
  cancelButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  saveButton: {
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 10,
  },
});
