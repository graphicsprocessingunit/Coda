import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, Text, FlatList, Pressable, TextInput, Modal, Animated, Easing } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme, Theme } from '../context/ThemeContext';
import { Playlist, TrackMetadata } from '../context/AudioContext';
import { EmptyState } from './EmptyState';
import { ConfirmDialog } from './ConfirmDialog';

interface PlaylistsProps {
  playlists: Playlist[];
  onCreatePlaylist: (name: string) => void;
  onDeletePlaylist: (playlistId: string) => void;
  onRenamePlaylist?: (playlistId: string, newName: string) => void;
  onPlayPlaylist: (playlist: Playlist) => void;
  onAddTrackToPlaylist: (playlistId: string, track: TrackMetadata) => void;
  onPlaylistPress?: (playlist: Playlist) => void;
  trackToAdd?: TrackMetadata | null;
}

function AnimatedPlaylistItem({ item, colors, onPress, onLongPress, canAddTrack, onAddToPlaylist }: {
  item: Playlist;
  colors: any;
  onPress: () => void;
  onLongPress: () => void;
  canAddTrack: boolean;
  onAddToPlaylist: () => void;
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
        onPress={onPress}
        onLongPress={onLongPress}
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
            onPress={onAddToPlaylist}
          >
            <Ionicons name="add-circle" size={24} color={colors.accent} />
          </Pressable>
        )}

        <Ionicons name="play-circle" size={24} color={colors.textSecondary} />
      </Pressable>
    </Animated.View>
  );
}

export function Playlists({
  playlists,
  onCreatePlaylist,
  onDeletePlaylist,
  onRenamePlaylist,
  onPlayPlaylist,
  onAddTrackToPlaylist,
  onPlaylistPress,
  trackToAdd,
}: PlaylistsProps) {
  const { colors } = useTheme();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [playlistName, setPlaylistName] = useState('');
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [renameTarget, setRenameTarget] = useState<Playlist | null>(null);
  const [renameName, setRenameName] = useState('');
  const [dialogVisible, setDialogVisible] = useState(false);
  const [dialogTitle, setDialogTitle] = useState('');
  const [dialogActions, setDialogActions] = useState<{ label: string; onPress: () => void; style?: 'default' | 'destructive' | 'cancel' }[]>([]);

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
    const actions: { label: string; onPress: () => void; style?: 'default' | 'destructive' | 'cancel' }[] = [
      { label: 'Cancel', style: 'cancel', onPress: () => {} },
      {
        label: 'Delete',
        style: 'destructive',
        onPress: () => onDeletePlaylist(item.id),
      },
    ];
    if (onRenamePlaylist) {
      actions.unshift({
        label: 'Rename',
        onPress: () => {
          setRenameTarget(item);
          setRenameName(item.name);
          setShowRenameModal(true);
        },
      });
    }
    setDialogTitle(item.name);
    setDialogActions(actions);
    setDialogVisible(true);
  };

  const handleAddToPlaylist = (playlistId: string) => {
    if (trackToAdd) {
      onAddTrackToPlaylist(playlistId, trackToAdd);
    }
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

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Playlists</Text>
        <Pressable style={styles.addButton} onPress={() => setShowCreateModal(true)}>
          <Ionicons name="add-circle" size={24} color={colors.accent} />
        </Pressable>
      </View>

      {playlists.length === 0 ? (
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
        <FlatList
          data={playlists}
          renderItem={renderPlaylist}
          keyExtractor={(item) => item.id}
          style={styles.list}
          contentContainerStyle={styles.listContent}
        />
      )}

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
      <ConfirmDialog
        visible={dialogVisible}
        title={dialogTitle}
        actions={dialogActions}
        onClose={() => setDialogVisible(false)}
      />
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
});
