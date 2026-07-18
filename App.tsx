import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';
import { useState, useEffect, useRef } from 'react';
import { Alert, Modal, View, Text, Pressable, FlatList, StyleSheet, Animated, ScrollView, TextInput, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AudioProvider, useAudio, Playlist, TrackMetadata } from './src/context/AudioContext';
import { ThemeProvider, useTheme } from './src/context/ThemeContext';
import { Player } from './src/components/Player';
import { TrackList } from './src/components/TrackList';
import { Playlists } from './src/components/Playlists';
import { PlaylistDetail } from './src/components/PlaylistDetail';
import { Settings } from './src/components/Settings';
import { MiniPlayer } from './src/components/MiniPlayer';
import { Queue } from './src/components/Queue';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import { TrackInfo } from './src/components/TrackInfo';
import { AudioEffectsSection } from './src/components/AudioEffects';
import { OfflineCacheService } from './src/services/OfflineCacheService';
import { SleepTimerSection } from './src/components/SleepTimer';
import { FilePickerService } from './src/services/FilePickerService';
import { Toast } from './src/components/Toast';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

function AnimatedTabIcon({ name, color, size, focused }: { name: string; color: string; size: number; focused: boolean }) {
  const scale = useRef(new Animated.Value(focused ? 1.15 : 0.9)).current;

  useEffect(() => {
    Animated.spring(scale, {
      toValue: focused ? 1.15 : 0.9,
      useNativeDriver: true,
      damping: 10,
      stiffness: 200,
    }).start();
  }, [focused]);

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Ionicons name={name as any} size={size} color={color} />
    </Animated.View>
  );
}

function PlayerScreen() {
  const {
    currentTrack,
    isPlaying,
    playbackPosition,
    duration,
    loadTrack,
    play,
    pause,
    skipNext,
    skipPrevious,
    seekTo,
    shuffleEnabled,
    repeatEnabled,
    toggleShuffle,
    toggleRepeat,
    toggleFavorite,
    sleepTimerRemaining,
  } = useAudio();
  const { colors } = useTheme();
  const [showEffects, setShowEffects] = useState(false);
  const [showQueue, setShowQueue] = useState(false);
  const [showTrackInfo, setShowTrackInfo] = useState(false);
  const [showMore, setShowMore] = useState(false);

  return (
    <>
      {!currentTrack ? (
        <Player
          currentTrack={null}
          isPlaying={false}
          playbackPosition={0}
          duration={0}
          onPlay={() => {}}
          onPause={() => {}}
          onSkipNext={() => {}}
          onSkipPrevious={() => {}}
          onSeek={() => {}}
          shuffleEnabled={shuffleEnabled}
          repeatEnabled={repeatEnabled}
          onToggleShuffle={toggleShuffle}
          onToggleRepeat={toggleRepeat}
          onMorePress={() => setShowMore(true)}
        />
      ) : (
        <Player
          currentTrack={currentTrack}
          isPlaying={isPlaying}
          playbackPosition={playbackPosition}
          duration={duration}
          onPlay={play}
          onPause={pause}
          onSkipNext={skipNext}
          onSkipPrevious={skipPrevious}
          onSeek={seekTo}
          shuffleEnabled={shuffleEnabled}
          repeatEnabled={repeatEnabled}
          onToggleShuffle={toggleShuffle}
          onToggleRepeat={toggleRepeat}
          onToggleFavorite={() => currentTrack && toggleFavorite(currentTrack.uri)}
          isFavorite={currentTrack?.isFavorite}
          onMorePress={() => setShowMore(true)}
          sleepTimerRemaining={sleepTimerRemaining}
        />
      )}
      <Modal
        visible={showMore}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowMore(false)}
      >
        <View style={effectsModalStyles.overlay}>
          <View style={[effectsModalStyles.content, { backgroundColor: colors.background }]}>
            <View style={[effectsModalStyles.header, { borderBottomColor: colors.border }]}>
              <Text style={[effectsModalStyles.title, { color: colors.text }]}>More</Text>
              <Pressable onPress={() => setShowMore(false)} hitSlop={10}>
                <Ionicons name="close" size={28} color={colors.textSecondary} />
              </Pressable>
            </View>
            <View style={{ padding: 12 }}>
              <Pressable
                style={[moreMenuStyles.row, { borderBottomColor: colors.border }]}
                onPress={() => { setShowMore(false); setTimeout(() => setShowQueue(true), 200); }}
              >
                <Ionicons name="list" size={24} color={colors.textSecondary} />
                <Text style={[moreMenuStyles.rowText, { color: colors.text }]}>Queue</Text>
                <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
              </Pressable>
              <Pressable
                style={[moreMenuStyles.row, { borderBottomColor: colors.border }]}
                onPress={() => { setShowMore(false); setTimeout(() => setShowEffects(true), 200); }}
              >
                <Ionicons name="options" size={24} color={colors.textSecondary} />
                <Text style={[moreMenuStyles.rowText, { color: colors.text }]}>Audio Settings</Text>
                <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
              </Pressable>
              <Pressable
                style={moreMenuStyles.row}
                onPress={() => { setShowMore(false); setTimeout(() => setShowTrackInfo(true), 200); }}
              >
                <Ionicons name="information-circle" size={24} color={colors.textSecondary} />
                <Text style={[moreMenuStyles.rowText, { color: colors.text }]}>Song Info</Text>
                <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
      <Modal
        visible={showEffects}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowEffects(false)}
      >
        <View style={effectsModalStyles.overlay}>
          <View style={[effectsModalStyles.content, { backgroundColor: colors.background }]}>
            <View style={[effectsModalStyles.header, { borderBottomColor: colors.border }]}>
              <Text style={[effectsModalStyles.title, { color: colors.text }]}>Audio Settings</Text>
              <Pressable onPress={() => setShowEffects(false)} hitSlop={10}>
                <Ionicons name="close" size={28} color={colors.textSecondary} />
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
              <AudioEffectsSection />
              <SleepTimerSection />
            </ScrollView>
          </View>
        </View>
      </Modal>
      <Modal
        visible={showQueue}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowQueue(false)}
      >
        <View style={queueModalStyles.overlay}>
          <View style={[queueModalStyles.content, { backgroundColor: colors.background }]}>
            <Queue onClose={() => setShowQueue(false)} />
          </View>
        </View>
      </Modal>
      <Modal
        visible={showTrackInfo}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowTrackInfo(false)}
      >
        <View style={effectsModalStyles.overlay}>
          <View style={[effectsModalStyles.content, { backgroundColor: colors.background }]}>
            <View style={[effectsModalStyles.header, { borderBottomColor: colors.border }]}>
              <Text style={[effectsModalStyles.title, { color: colors.text }]}>Song Info</Text>
              <Pressable onPress={() => setShowTrackInfo(false)} hitSlop={10}>
                <Ionicons name="close" size={28} color={colors.textSecondary} />
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
              {currentTrack && <TrackInfo track={currentTrack} duration={duration} />}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}

function LibraryScreen() {
  const { library, currentTrack, playFromLibrary, addToLibrary, removeFromLibrary, playlists, addTrackToPlaylist, createPlaylist, playNextInQueue, addToQueue, toggleFavorite } = useAudio();
  const { colors } = useTheme();
  const [selectedTrack, setSelectedTrack] = useState<TrackMetadata | null>(null);
  const [showPlaylistModal, setShowPlaylistModal] = useState(false);
  const [showCreateFromLibraryModal, setShowCreateFromLibraryModal] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');

  const handleAddTracks = async () => {
    const files = await FilePickerService.pickAudioFiles();
    if (files.length > 0) {
      const tracks = await FilePickerService.filesToTracks(files);
      addToLibrary(tracks);
    }
  };

  const handleTrackPress = (track: any) => {
    playFromLibrary(track);
  };

  const handleTrackLongPress = (track: TrackMetadata) => {
    Alert.alert(
      track.title,
      track.artist,
      [
        {
          text: 'Play Next',
          onPress: () => playNextInQueue(track),
        },
        {
          text: 'Add to Queue',
          onPress: () => addToQueue(track),
        },
        {
          text: 'Add to Playlist',
          onPress: () => {
            setSelectedTrack(track);
            setShowPlaylistModal(true);
          },
        },
        {
          text: track.isFavorite ? 'Remove from Favorites' : 'Add to Favorites',
          onPress: () => toggleFavorite(track.uri),
        },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const handleAddToPlaylist = (playlistId: string) => {
    if (selectedTrack) {
      addTrackToPlaylist(playlistId, selectedTrack);
      setShowPlaylistModal(false);
      setSelectedTrack(null);
    }
  };

  const handleCreateNewPlaylist = () => {
    setNewPlaylistName('');
    setShowCreateFromLibraryModal(true);
  };

  const handleConfirmCreatePlaylist = () => {
    if (newPlaylistName.trim() && selectedTrack) {
      const newId = createPlaylist(newPlaylistName.trim());
      addTrackToPlaylist(newId, selectedTrack);
      setShowPlaylistModal(false);
      setShowCreateFromLibraryModal(false);
      setSelectedTrack(null);
      setNewPlaylistName('');
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <TrackList
        tracks={library}
        currentTrack={currentTrack}
        onTrackPress={handleTrackPress}
        onAddTracks={handleAddTracks}
        onTrackLongPress={handleTrackLongPress}
        onRemoveTrack={removeFromLibrary}
        onToggleFavorite={toggleFavorite}
      />
      <MiniPlayer />
      <Modal
        visible={showPlaylistModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowPlaylistModal(false)}
      >
        <View style={modalStyles.modalOverlay}>
          <SafeAreaView style={[modalStyles.modalContent, { backgroundColor: colors.card }]} edges={['bottom']}>
            <Text style={[modalStyles.modalTitle, { color: colors.text }]}>Add to Playlist</Text>
            {playlists.length === 0 ? (
              <View style={modalStyles.emptyState}>
                <Text style={[modalStyles.emptyText, { color: colors.textSecondary }]}>No playlists yet</Text>
                <Pressable style={[modalStyles.createButton, { backgroundColor: colors.accent }]} onPress={handleCreateNewPlaylist}>
                  <Text style={modalStyles.createButtonText}>Create Playlist</Text>
                </Pressable>
              </View>
            ) : (
              <FlatList
                data={playlists}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <Pressable
                    style={[modalStyles.playlistItem, { borderBottomColor: colors.border }]}
                    onPress={() => handleAddToPlaylist(item.id)}
                  >
                    <Text style={[modalStyles.playlistName, { color: colors.text }]}>{item.name}</Text>
                    <Text style={[modalStyles.playlistCount, { color: colors.textSecondary }]}>{item.tracks.length} tracks</Text>
                  </Pressable>
                )}
                style={modalStyles.playlistList}
              />
            )}
            <Pressable
              style={[modalStyles.cancelButton, { backgroundColor: colors.border }]}
              onPress={() => {
                setShowPlaylistModal(false);
                setSelectedTrack(null);
              }}
            >
              <Text style={[modalStyles.cancelButtonText, { color: colors.text }]}>Cancel</Text>
            </Pressable>
            {playlists.length > 0 && (
              <Pressable style={[modalStyles.newPlaylistButton, { backgroundColor: colors.border }]} onPress={handleCreateNewPlaylist}>
                <Ionicons name="add-circle" size={20} color={colors.accent} />
                <Text style={[modalStyles.newPlaylistText, { color: colors.accent }]}>New Playlist</Text>
              </Pressable>
            )}
          </SafeAreaView>
        </View>
      </Modal>

      <Modal
        visible={showCreateFromLibraryModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => {
          setShowCreateFromLibraryModal(false);
          setNewPlaylistName('');
        }}
      >
        <Pressable style={modalStyles.modalOverlay} onPress={() => {
          setShowCreateFromLibraryModal(false);
          setNewPlaylistName('');
        }}>
          <Pressable style={[modalStyles.modalContent, { backgroundColor: colors.card }]} onPress={(e) => e.stopPropagation()}>
            <Text style={[modalStyles.modalTitle, { color: colors.text }]}>Create Playlist</Text>
            <TextInput
              style={[modalStyles.input, { backgroundColor: colors.border, color: colors.text }]}
              placeholder="Playlist name"
              placeholderTextColor={colors.textSecondary}
              value={newPlaylistName}
              onChangeText={setNewPlaylistName}
              autoFocus
            />
            <View style={modalStyles.modalButtons}>
              <Pressable
                style={[modalStyles.modalButton, { backgroundColor: 'transparent' }]}
                onPress={() => {
                  setShowCreateFromLibraryModal(false);
                  setNewPlaylistName('');
                }}
              >
                <Text style={[modalStyles.modalButtonText, { color: colors.textSecondary }]}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[modalStyles.modalButton, { backgroundColor: colors.accent }]}
                onPress={handleConfirmCreatePlaylist}
              >
                <Text style={[modalStyles.modalButtonText, { color: colors.text }]}>Create</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function PlaylistsScreen({ navigation }: any) {
  const { 
    playlists, 
    createPlaylist, 
    deletePlaylist,
    renamePlaylist,
    playPlaylist, 
    addTrackToPlaylist 
  } = useAudio();

  const handlePlaylistPress = (playlist: Playlist) => {
    navigation.navigate('PlaylistDetail', { playlistId: playlist.id });
  };

  return (
    <Playlists
      playlists={playlists}
      onCreatePlaylist={createPlaylist}
      onDeletePlaylist={deletePlaylist}
      onRenamePlaylist={renamePlaylist}
      onPlayPlaylist={playPlaylist}
      onAddTrackToPlaylist={addTrackToPlaylist}
      onPlaylistPress={handlePlaylistPress}
    />
  );
}

function PlaylistDetailScreen({ route, navigation }: any) {
  const { currentTrack, removeTrackFromPlaylist, reorderPlaylistTracks, addTrackToPlaylist, library, playlists, playPlaylist, playFromPlaylist, renamePlaylist } = useAudio();
  const { playlistId } = route.params;
  const playlist = playlists.find((p) => p.id === playlistId);

  if (!playlist) {
    return null;
  }

  return (
    <PlaylistDetail
      playlist={playlist}
      currentTrack={currentTrack}
      onTrackPress={(track: TrackMetadata) => playFromPlaylist(playlist, track)}
      onRemoveTrack={(trackUri) => removeTrackFromPlaylist(playlist.id, trackUri)}
      onReorderTrack={(fromIndex: number, toIndex: number) => reorderPlaylistTracks(playlist.id, fromIndex, toIndex)}
      onPlayPlaylist={() => playPlaylist(playlist)}
      onBack={() => navigation.goBack()}
      onAddTrack={(track) => addTrackToPlaylist(playlist.id, track)}
      onRename={(newName) => renamePlaylist(playlist.id, newName)}
      library={library}
    />
  );
}

function PlaylistsStack() {
  return (
    <View style={{ flex: 1 }}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="PlaylistsList" component={PlaylistsScreen} />
        <Stack.Screen name="PlaylistDetail" component={PlaylistDetailScreen} />
      </Stack.Navigator>
      <MiniPlayer />
    </View>
  );
}

function SettingsScreen() {
  const { colors } = useTheme();
  const { clearAllData } = useAudio();

  const handleClearData = () => {
    Alert.alert(
      'Clear All Data',
      'This will delete all your playlists, library, and settings. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            await clearAllData();
            Alert.alert('Success', 'All data has been cleared.');
          },
        },
      ]
    );
  };

  const handleClearCache = () => {
    Alert.alert(
      'Clear Cache',
      'This will delete all cached Navidrome tracks and artwork.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: () => {
            OfflineCacheService.clearCache();
            Alert.alert('Success', 'Cache cleared.');
          },
        },
      ]
    );
  };

  return (
    <View style={{ flex: 1 }}>
      <Settings onClearData={handleClearData} onClearCache={handleClearCache} />
      <MiniPlayer />
    </View>
  );
}

function MainTabs() {
  const { colors } = useTheme();
  const { error, clearError, isLoading } = useAudio();

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={{ color: colors.textSecondary, marginTop: 16, fontSize: 15 }}>Loading...</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      {error && <Toast message={error} type="error" onDismiss={clearError} />}
      <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.tabBar,
          borderTopColor: colors.border,
          borderTopWidth: 1,
        },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textSecondary,
      }}
    >
      <Tab.Screen
        name="Player"
        component={PlayerScreen}
        options={{
          tabBarIcon: ({ color, size, focused }) => (
            <AnimatedTabIcon name="play-circle" color={color} size={size} focused={focused} />
          ),
        }}
      />
      <Tab.Screen
        name="Library"
        component={LibraryScreen}
        options={{
          tabBarIcon: ({ color, size, focused }) => (
            <AnimatedTabIcon name="musical-notes" color={color} size={size} focused={focused} />
          ),
        }}
      />
      <Tab.Screen
        name="Playlists"
        component={PlaylistsStack}
        options={{
          tabBarIcon: ({ color, size, focused }) => (
            <AnimatedTabIcon name="list" color={color} size={size} focused={focused} />
          ),
        }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          tabBarIcon: ({ color, size, focused }) => (
            <AnimatedTabIcon name="settings" color={color} size={size} focused={focused} />
          ),
        }}
      />
    </Tab.Navigator>
    </View>
  );
}

function ThemedStatusBar() {
  const { isDark } = useTheme();
  return <StatusBar style={isDark ? 'light' : 'dark'} />;
}

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <AudioProvider>
          <NavigationContainer>
            <MainTabs />
            <ThemedStatusBar />
          </NavigationContainer>
        </AudioProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

const modalStyles = StyleSheet.create({
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
  modalTitle: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 16,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 16,
    marginBottom: 16,
  },
  createButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  createButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  playlistList: {
    flex: 1,
    marginBottom: 16,
  },
  playlistItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  playlistName: {
    fontSize: 18,
    fontWeight: '600',
  },
  playlistCount: {
    fontSize: 14,
  },
  cancelButton: {
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 12,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  newPlaylistButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 8,
    gap: 8,
  },
  newPlaylistText: {
    fontSize: 16,
    fontWeight: '600',
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
  modalButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});

const effectsModalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  content: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '85%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
  },
});

const queueModalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  content: {
    flex: 1,
    marginTop: 60,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
});

const moreMenuStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
  },
});
