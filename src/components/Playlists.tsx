import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, Text, FlatList, Pressable, TextInput, Modal, Alert, Animated, Easing, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme, Theme } from '../context/ThemeContext';
import { Playlist, TrackMetadata, SmartPlaylist, SmartPlaylistRule } from '../context/AudioContext';
import { evaluateSmartPlaylist } from '../services/SmartPlaylistEngine';
import { EmptyState } from './EmptyState';

interface PlaylistsProps {
  playlists: Playlist[];
  smartPlaylists?: SmartPlaylist[];
  library?: TrackMetadata[];
  onCreatePlaylist: (name: string) => void;
  onDeletePlaylist: (playlistId: string) => void;
  onRenamePlaylist?: (playlistId: string, newName: string) => void;
  onPlayPlaylist: (playlist: Playlist) => void;
  onAddTrackToPlaylist: (playlistId: string, track: TrackMetadata) => void;
  onPlaylistPress?: (playlist: Playlist) => void;
  onSmartPlaylistPress?: (playlist: SmartPlaylist) => void;
  onCreateSmartPlaylist?: (name: string, rules: SmartPlaylistRule[], options?: { limit?: number; sortField?: 'playCount' | 'title'; sortDirection?: 'asc' | 'desc'; icon?: string }) => string;
  onDeleteSmartPlaylist?: (id: string) => void;
  trackToAdd?: TrackMetadata | null;
}

const AnimatedPlaylistItem = React.memo(function AnimatedPlaylistItem({ item, colors, onPress, onLongPress, canAddTrack, onAddToPlaylist }: {
  item: Playlist;
  colors: any;
  onPress: (item: Playlist) => void;
  onLongPress: (item: Playlist) => void;
  canAddTrack: boolean;
  onAddToPlaylist: (id: string) => void;
}) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(20)).current;
  const pressScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 300, delay: 100, useNativeDriver: true }),
      Animated.spring(translateY, { toValue: 0, useNativeDriver: true, damping: 15, stiffness: 100, delay: 100 }),
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
        style={[styles.playlistItem, { backgroundColor: colors.background }]}
        onPress={() => onPress(item)}
        onLongPress={() => onLongPress(item)}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
      >
        <View style={[styles.playlistIcon, { backgroundColor: colors.card }]}>
          <Ionicons name="list" size={32} color={colors.accent} />
        </View>

        <View style={styles.playlistInfo}>
          <Text style={[styles.playlistName, { color: colors.text }]} numberOfLines={1}>
            {item.name}
          </Text>
          <Text style={[styles.playlistCount, { color: colors.textSecondary }]}>
            {item.tracks.length} {item.tracks.length === 1 ? 'track' : 'tracks'}
          </Text>
        </View>

        {canAddTrack && (
          <Pressable
            style={styles.addToButton}
            onPress={() => onAddToPlaylist(item.id)}
          >
            <Ionicons name="add-circle" size={24} color={colors.accent} />
          </Pressable>
        )}

        <Ionicons name="play-circle" size={24} color={colors.textSecondary} />
      </Pressable>
    </Animated.View>
  );
});

export function Playlists({
  playlists,
  smartPlaylists = [],
  library = [],
  onCreatePlaylist,
  onDeletePlaylist,
  onRenamePlaylist,
  onPlayPlaylist,
  onAddTrackToPlaylist,
  onPlaylistPress,
  onSmartPlaylistPress,
  onCreateSmartPlaylist,
  onDeleteSmartPlaylist,
  trackToAdd,
}: PlaylistsProps) {
  const { colors } = useTheme();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [playlistName, setPlaylistName] = useState('');
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [renameTarget, setRenameTarget] = useState<Playlist | null>(null);
  const [renameName, setRenameName] = useState('');
  const [showCreateSmartModal, setShowCreateSmartModal] = useState(false);
  const [smartPlaylistName, setSmartPlaylistName] = useState('');
  const [smartPlaylistRules, setSmartPlaylistRules] = useState<SmartPlaylistRule[]>([]);
  const [smartPlaylistLimit, setSmartPlaylistLimit] = useState('50');
  const [smartPlaylistSortField, setSmartPlaylistSortField] = useState<'playCount' | 'title'>('title');
  const [ruleField, setRuleField] = useState<'playCount' | 'isFavorite' | 'artist' | 'album' | 'source'>('playCount');
  const [ruleOp, setRuleOp] = useState<'gte' | 'lte' | 'eq'>('gte');
  const [ruleValueText, setRuleValueText] = useState('');
  const [ruleValueBool, setRuleValueBool] = useState(true);
  const [ruleValueSource, setRuleValueSource] = useState<'local' | 'navidrome'>('local');

  const handleCreatePlaylist = () => {
    if (playlistName.trim()) {
      onCreatePlaylist(playlistName.trim());
      setPlaylistName('');
      setShowCreateModal(false);
    }
  };

  const handleRename = () => {
    if (renameName.trim() && renameTarget && onRenamePlaylist) {
      onRenamePlaylist(renameTarget.id, renameName.trim());
      setRenameTarget(null);
      setRenameName('');
      setShowRenameModal(false);
    }
  };

  const handleLongPress = (item: Playlist) => {
    const options: any[] = [
      { text: 'Cancel', style: 'cancel' as const },
      {
        text: 'Delete',
        style: 'destructive' as const,
        onPress: () => onDeletePlaylist(item.id),
      },
    ];
    if (onRenamePlaylist) {
      options.unshift({
        text: 'Rename',
        onPress: () => {
          setRenameTarget(item);
          setRenameName(item.name);
          setShowRenameModal(true);
        },
      });
    }
    Alert.alert('Playlist', `"${item.name}"`, options);
  };

  const handleAddToPlaylist = (playlistId: string) => {
    if (trackToAdd) {
      onAddTrackToPlaylist(playlistId, trackToAdd);
    }
  };

  const handleAddRule = () => {
    let rule: SmartPlaylistRule | null = null;
    switch (ruleField) {
      case 'playCount':
        rule = { field: 'playCount', op: ruleOp, value: parseInt(ruleValueText, 10) || 0 };
        break;
      case 'isFavorite':
        rule = { field: 'isFavorite', op: 'eq', value: ruleValueBool };
        break;
      case 'artist':
        if (!ruleValueText.trim()) return;
        rule = { field: 'artist', op: 'eq', value: ruleValueText.trim() };
        break;
      case 'album':
        if (!ruleValueText.trim()) return;
        rule = { field: 'album', op: 'eq', value: ruleValueText.trim() };
        break;
      case 'source':
        rule = { field: 'source', op: 'eq', value: ruleValueSource };
        break;
    }
    if (rule) {
      setSmartPlaylistRules((prev) => [...prev, rule!]);
      setRuleValueText('');
    }
  };

  const handleCreateSmartPlaylist = () => {
    if (smartPlaylistName.trim() && smartPlaylistRules.length > 0 && onCreateSmartPlaylist) {
      onCreateSmartPlaylist(smartPlaylistName.trim(), smartPlaylistRules, {
        limit: parseInt(smartPlaylistLimit, 10) || 50,
        sortField: smartPlaylistSortField,
        sortDirection: 'desc',
      });
      setSmartPlaylistName('');
      setSmartPlaylistRules([]);
      setSmartPlaylistLimit('50');
      setSmartPlaylistSortField('title');
      setShowCreateSmartModal(false);
    }
  };

  const handleSmartPlaylistLongPress = (item: SmartPlaylist) => {
    Alert.alert(item.name, 'Delete this smart playlist?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => onDeleteSmartPlaylist?.(item.id) },
    ]);
  };

  const renderPlaylist = ({ item }: { item: Playlist }) => {
    const canAddTrack = trackToAdd && !item.tracks.some((t) => t.uri === trackToAdd.uri);

    return (
      <AnimatedPlaylistItem
        item={item}
        colors={colors}
        onPress={() => onPlaylistPress ? onPlaylistPress(item) : onPlayPlaylist(item)}
        onLongPress={() => handleLongPress(item)}
        canAddTrack={!!canAddTrack}
        onAddToPlaylist={() => handleAddToPlaylist(item.id)}
      />
    );
  };

  const renderSmartPlaylistItem = ({ item }: { item: SmartPlaylist }) => {
    const trackCount = library.length > 0 ? evaluateSmartPlaylist(library, item).length : 0;

    return (
      <Pressable
        style={[styles.playlistItem, { backgroundColor: colors.background }]}
        onPress={() => onSmartPlaylistPress?.(item)}
        onLongPress={() => handleSmartPlaylistLongPress(item)}
      >
        <View style={[styles.playlistIcon, { backgroundColor: colors.card }]}>
          <Ionicons name="prism" size={32} color={colors.accent} />
        </View>

        <View style={styles.playlistInfo}>
          <Text style={[styles.playlistName, { color: colors.text }]} numberOfLines={1}>
            {item.name}
          </Text>
          <Text style={[styles.playlistCount, { color: colors.textSecondary }]}>
            {trackCount} {trackCount === 1 ? 'track' : 'tracks'}
          </Text>
        </View>

        <Ionicons name="play-circle" size={24} color={colors.textSecondary} />
      </Pressable>
    );
  };

  const ruleFieldOptions: { value: typeof ruleField; label: string }[] = [
    { value: 'playCount', label: 'Play Count' },
    { value: 'isFavorite', label: 'Favorite' },
    { value: 'artist', label: 'Artist' },
    { value: 'album', label: 'Album' },
    { value: 'source', label: 'Source' },
  ];

  const showValueInput = ruleField === 'playCount' || ruleField === 'artist' || ruleField === 'album';

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Playlists</Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {onCreateSmartPlaylist && (
            <Pressable style={styles.addButton} onPress={() => setShowCreateSmartModal(true)}>
              <Ionicons name="prism" size={24} color={colors.accent} />
            </Pressable>
          )}
          <Pressable style={styles.addButton} onPress={() => setShowCreateModal(true)}>
            <Ionicons name="add-circle" size={24} color={colors.accent} />
          </Pressable>
        </View>
      </View>

      <FlatList
        data={[]}
        renderItem={() => null}
        ListHeaderComponent={() => (
          <>
            {smartPlaylists.length > 0 && (
              <>
                <View style={[styles.sectionHeader, { borderBottomColor: colors.border }]}>
                  <Ionicons name="prism" size={18} color={colors.accent} />
                  <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Smart Playlists</Text>
                </View>
                {smartPlaylists.map((item) => (
                  <React.Fragment key={item.id}>
                    {renderSmartPlaylistItem({ item })}
                  </React.Fragment>
                ))}
              </>
            )}

            <View style={[styles.sectionHeader, { borderBottomColor: colors.border }]}>
              <Ionicons name="list" size={18} color={colors.accent} />
              <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Playlists</Text>
            </View>
            {playlists.length === 0 && smartPlaylists.length === 0 ? (
              <EmptyState
                icon="list"
                decorativeIcons={[
                  { name: 'add-circle-outline', offset: { x: -25, y: -18 }, size: 18, delay: 400 },
                  { name: 'musical-notes-outline', offset: { x: 25, y: 18 }, size: 16, delay: 600 },
                ]}
                title="No playlists yet"
                subtitle="Tap + to create a playlist"
              />
            ) : (
              playlists.map((item) => {
                const canAddTrack = trackToAdd && !item.tracks.some((t) => t.uri === trackToAdd.uri);
                return (
                  <AnimatedPlaylistItem
                    key={item.id}
                    item={item}
                    colors={colors}
                    onPress={() => onPlaylistPress ? onPlaylistPress(item) : onPlayPlaylist(item)}
                    onLongPress={() => handleLongPress(item)}
                    canAddTrack={!!canAddTrack}
                    onAddToPlaylist={() => handleAddToPlaylist(item.id)}
                  />
                );
              })
            )}
          </>
        )}
        keyExtractor={() => 'dummy'}
        style={styles.list}
        contentContainerStyle={styles.listContent}
      />

      <Modal
        visible={showCreateModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowCreateModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Create Playlist</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.border, color: colors.text }]}
              placeholder="Playlist name"
              placeholderTextColor={colors.textSecondary}
              value={playlistName}
              onChangeText={setPlaylistName}
              autoFocus
            />
            <View style={styles.modalButtons}>
              <Pressable
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => {
                  setShowCreateModal(false);
                  setPlaylistName('');
                }}
              >
                <Text style={[styles.cancelButtonText, { color: colors.textSecondary }]}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.modalButton, { backgroundColor: colors.accent }]}
                onPress={handleCreatePlaylist}
              >
                <Text style={[styles.createButtonText, { color: colors.text }]}>Create</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showRenameModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => {
          setShowRenameModal(false);
          setRenameTarget(null);
          setRenameName('');
        }}
      >
        <Pressable style={styles.modalOverlay} onPress={() => {
          setShowRenameModal(false);
          setRenameTarget(null);
          setRenameName('');
        }}>
          <Pressable style={[styles.modalContent, { backgroundColor: colors.card }]} onPress={(e) => e.stopPropagation()}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Rename Playlist</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.border, color: colors.text }]}
              placeholder="Playlist name"
              placeholderTextColor={colors.textSecondary}
              value={renameName}
              onChangeText={setRenameName}
              autoFocus
            />
            <View style={styles.modalButtons}>
              <Pressable
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => {
                  setShowRenameModal(false);
                  setRenameTarget(null);
                  setRenameName('');
                }}
              >
                <Text style={[styles.cancelButtonText, { color: colors.textSecondary }]}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.modalButton, { backgroundColor: colors.accent }]}
                onPress={handleRename}
              >
                <Text style={[styles.createButtonText, { color: colors.text }]}>Rename</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={showCreateSmartModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowCreateSmartModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card, maxHeight: '85%' }]}>
            <ScrollView>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Create Smart Playlist</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.border, color: colors.text }]}
                placeholder="Playlist name"
                placeholderTextColor={colors.textSecondary}
                value={smartPlaylistName}
                onChangeText={setSmartPlaylistName}
                autoFocus
              />

              <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Rules</Text>
              {smartPlaylistRules.map((rule, i) => (
                <View key={i} style={[styles.ruleRow, { backgroundColor: colors.border }]}>
                  <Text style={[styles.ruleText, { color: colors.text, flex: 1 }]}>
                    {rule.field === 'playCount' && `Play count ${rule.op === 'gte' ? '≥' : rule.op === 'lte' ? '≤' : '='} ${rule.value}`}
                    {rule.field === 'isFavorite' && (rule.value ? 'Is favorite' : 'Not favorite')}
                    {rule.field === 'artist' && `Artist: ${rule.value}`}
                    {rule.field === 'album' && `Album: ${rule.value}`}
                    {rule.field === 'source' && `Source: ${rule.value}`}
                  </Text>
                  <Pressable onPress={() => setSmartPlaylistRules((prev) => prev.filter((_, j) => j !== i))}>
                    <Ionicons name="close-circle" size={20} color="#FF3B30" />
                  </Pressable>
                </View>
              ))}

              <Text style={[styles.sectionLabel, { color: colors.textSecondary, marginTop: 12 }]}>Add Rule</Text>
              <View style={styles.ruleBuilder}>
                <View style={[styles.rulePicker, { backgroundColor: colors.border }]}>
                  <Text style={[styles.rulePickerLabel, { color: colors.textSecondary }]}>Field</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    {ruleFieldOptions.map((opt) => (
                      <Pressable
                        key={opt.value}
                        style={[styles.rulePickerOption, ruleField === opt.value && { backgroundColor: colors.accent }]}
                        onPress={() => { setRuleField(opt.value); setRuleValueText(''); }}
                      >
                        <Text style={[styles.rulePickerOptionText, { color: ruleField === opt.value ? '#fff' : colors.text }]}>{opt.label}</Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                </View>

                {(ruleField === 'playCount') && (
                  <View style={[styles.rulePicker, { backgroundColor: colors.border }]}>
                    <Text style={[styles.rulePickerLabel, { color: colors.textSecondary }]}>Operator</Text>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      {(['gte', 'lte', 'eq'] as const).map((op) => (
                        <Pressable
                          key={op}
                          style={[styles.rulePickerOption, ruleOp === op && { backgroundColor: colors.accent }]}
                          onPress={() => setRuleOp(op)}
                        >
                          <Text style={[styles.rulePickerOptionText, { color: ruleOp === op ? '#fff' : colors.text }]}>
                            {op === 'gte' ? '≥' : op === 'lte' ? '≤' : '='}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>
                )}

                {showValueInput && (
                  <TextInput
                    style={[styles.input, { backgroundColor: colors.border, color: colors.text }]}
                    placeholder={ruleField === 'playCount' ? 'Count' : 'Value'}
                    placeholderTextColor={colors.textSecondary}
                    value={ruleValueText}
                    onChangeText={setRuleValueText}
                    keyboardType={ruleField === 'playCount' ? 'numeric' : 'default'}
                  />
                )}

                {ruleField === 'isFavorite' && (
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <Pressable
                      style={[styles.rulePickerOption, { backgroundColor: colors.border }, ruleValueBool && { backgroundColor: colors.accent }]}
                      onPress={() => setRuleValueBool(true)}
                    >
                      <Text style={[styles.rulePickerOptionText, { color: ruleValueBool ? '#fff' : colors.text }]}>Yes</Text>
                    </Pressable>
                    <Pressable
                      style={[styles.rulePickerOption, { backgroundColor: colors.border }, !ruleValueBool && { backgroundColor: colors.accent }]}
                      onPress={() => setRuleValueBool(false)}
                    >
                      <Text style={[styles.rulePickerOptionText, { color: !ruleValueBool ? '#fff' : colors.text }]}>No</Text>
                    </Pressable>
                  </View>
                )}

                {ruleField === 'source' && (
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <Pressable
                      style={[styles.rulePickerOption, { backgroundColor: colors.border }, ruleValueSource === 'local' && { backgroundColor: colors.accent }]}
                      onPress={() => setRuleValueSource('local')}
                    >
                      <Text style={[styles.rulePickerOptionText, { color: ruleValueSource === 'local' ? '#fff' : colors.text }]}>Local</Text>
                    </Pressable>
                    <Pressable
                      style={[styles.rulePickerOption, { backgroundColor: colors.border }, ruleValueSource === 'navidrome' && { backgroundColor: colors.accent }]}
                      onPress={() => setRuleValueSource('navidrome')}
                    >
                      <Text style={[styles.rulePickerOptionText, { color: ruleValueSource === 'navidrome' ? '#fff' : colors.text }]}>Navidrome</Text>
                    </Pressable>
                  </View>
                )}

                <Pressable style={[styles.addRuleButton, { backgroundColor: colors.accent }]} onPress={handleAddRule}>
                  <Ionicons name="add" size={20} color="#fff" />
                  <Text style={styles.addRuleButtonText}>Add Rule</Text>
                </Pressable>
              </View>

              <Text style={[styles.sectionLabel, { color: colors.textSecondary, marginTop: 12 }]}>Sort & Limit</Text>
              <View style={{ flexDirection: 'row', gap: 12, marginBottom: 16 }}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.rulePickerLabel, { color: colors.textSecondary }]}>Sort by</Text>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <Pressable
                      style={[styles.rulePickerOption, { backgroundColor: colors.border }, smartPlaylistSortField === 'title' && { backgroundColor: colors.accent }]}
                      onPress={() => setSmartPlaylistSortField('title')}
                    >
                      <Text style={[styles.rulePickerOptionText, { color: smartPlaylistSortField === 'title' ? '#fff' : colors.text }]}>Title</Text>
                    </Pressable>
                    <Pressable
                      style={[styles.rulePickerOption, { backgroundColor: colors.border }, smartPlaylistSortField === 'playCount' && { backgroundColor: colors.accent }]}
                      onPress={() => setSmartPlaylistSortField('playCount')}
                    >
                      <Text style={[styles.rulePickerOptionText, { color: smartPlaylistSortField === 'playCount' ? '#fff' : colors.text }]}>Plays</Text>
                    </Pressable>
                  </View>
                </View>
                <View style={{ width: 80 }}>
                  <Text style={[styles.rulePickerLabel, { color: colors.textSecondary }]}>Limit</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: colors.border, color: colors.text, marginBottom: 0 }]}
                    placeholder="50"
                    placeholderTextColor={colors.textSecondary}
                    value={smartPlaylistLimit}
                    onChangeText={setSmartPlaylistLimit}
                    keyboardType="numeric"
                  />
                </View>
              </View>
            </ScrollView>

            <View style={styles.modalButtons}>
              <Pressable
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => {
                  setShowCreateSmartModal(false);
                  setSmartPlaylistName('');
                  setSmartPlaylistRules([]);
                  setSmartPlaylistLimit('50');
                  setSmartPlaylistSortField('title');
                }}
              >
                <Text style={[styles.cancelButtonText, { color: colors.textSecondary }]}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.modalButton, { backgroundColor: colors.accent }, (smartPlaylistName.trim() === '' || smartPlaylistRules.length === 0) && { opacity: 0.5 }]}
                onPress={handleCreateSmartPlaylist}
                disabled={smartPlaylistName.trim() === '' || smartPlaylistRules.length === 0}
              >
                <Text style={[styles.createButtonText, { color: colors.text }]}>Create</Text>
              </Pressable>
            </View>
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
  addButton: {
    padding: 8,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingVertical: 8,
  },
  playlistItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  playlistIcon: {
    width: 56,
    height: 56,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  playlistInfo: {
    flex: 1,
    marginRight: 12,
  },
  playlistName: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  playlistCount: {
    fontSize: 14,
  },
  addToButton: {
    padding: 8,
    marginRight: 8,
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
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    borderRadius: 16,
    padding: 24,
    width: '80%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 16,
  },
  input: {
    borderRadius: 8,
    padding: 16,
    fontSize: 16,
    marginBottom: 16,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  modalButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  cancelButton: {
    backgroundColor: 'transparent',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  createButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 8,
    borderBottomWidth: 1,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  ruleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    marginBottom: 8,
  },
  ruleText: {
    fontSize: 14,
    fontWeight: '500',
  },
  ruleBuilder: {
    gap: 12,
    marginBottom: 12,
  },
  rulePicker: {
    borderRadius: 8,
    padding: 10,
  },
  rulePickerLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  rulePickerOption: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  rulePickerOptionText: {
    fontSize: 13,
    fontWeight: '500',
  },
  addRuleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
  },
  addRuleButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});
