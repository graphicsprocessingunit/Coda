import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';
import { useState, useEffect, useRef } from 'react';
import { Alert, Modal, View, Text, Pressable, FlatList, StyleSheet, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AudioProvider, useAudio, SAMPLE_TRACK, Playlist, TrackMetadata } from './src/context/AudioContext';
import { ThemeProvider, useTheme } from './src/context/ThemeContext';
import { Player } from './src/components/Player';
import { TrackList } from './src/components/TrackList';
import { Playlists } from './src/components/Playlists';
import { PlaylistDetail } from './src/components/PlaylistDetail';
import { Settings } from './src/components/Settings';
import { FilePickerService } from './src/services/FilePickerService';
import { StorageService } from './src/services/StorageService';

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
  } = useAudio();
  const { colors } = useTheme();

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
        />
      )}
    </>
  );
}

function LibraryScreen() {
  const { library, currentTrack, playFromLibrary, addToLibrary, removeFromLibrary, playlists, addTrackToPlaylist, createPlaylist } = useAudio();
  const { colors } = useTheme();
  const [selectedTrack, setSelectedTrack] = useState<TrackMetadata | null>(null);
  const [showPlaylistModal, setShowPlaylistModal] = useState(false);

  const handleAddTracks = async () => {
    const files = await FilePickerService.pickAudioFiles();
    if (files.length > 0) {
      const tracks = FilePickerService.filesToTracks(files);
      addToLibrary(tracks);
    }
  };

  const handleTrackPress = (track: any) => {
    playFromLibrary(track);
  };

  const handleTrackLongPress = (track: TrackMetadata) => {
    setSelectedTrack(track);
    setShowPlaylistModal(true);
  };

  const handleAddToPlaylist = (playlistId: string) => {
    if (selectedTrack) {
      addTrackToPlaylist(playlistId, selectedTrack);
      setShowPlaylistModal(false);
      setSelectedTrack(null);
    }
  };

  const handleCreateNewPlaylist = () => {
    Alert.prompt(
      'Create Playlist',
      'Enter playlist name',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Create',
          onPress: (name?: string) => {
            if (name && selectedTrack) {
              createPlaylist(name);
              setShowPlaylistModal(false);
              setSelectedTrack(null);
            }
          },
        },
      ]
    );
  };

  return (
    <>
      <TrackList
        tracks={library}
        currentTrack={currentTrack}
        onTrackPress={handleTrackPress}
        onAddTracks={handleAddTracks}
        onTrackLongPress={handleTrackLongPress}
        onRemoveTrack={removeFromLibrary}
      />
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
    </>
  );
}

function PlaylistsScreen({ navigation }: any) {
  const { 
    playlists, 
    createPlaylist, 
    deletePlaylist, 
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
      onPlayPlaylist={playPlaylist}
      onAddTrackToPlaylist={addTrackToPlaylist}
      onPlaylistPress={handlePlaylistPress}
    />
  );
}

function PlaylistDetailScreen({ route, navigation }: any) {
  const { currentTrack, removeTrackFromPlaylist, addTrackToPlaylist, library, playlists, playPlaylist, playFromPlaylist } = useAudio();
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
      onPlayPlaylist={() => playPlaylist(playlist)}
      onBack={() => navigation.goBack()}
      onAddTrack={(track) => addTrackToPlaylist(playlist.id, track)}
      library={library}
    />
  );
}

function PlaylistsStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="PlaylistsList" component={PlaylistsScreen} />
      <Stack.Screen name="PlaylistDetail" component={PlaylistDetailScreen} />
    </Stack.Navigator>
  );
}

function SettingsScreen() {
  const { colors } = useTheme();

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
            await StorageService.clearAll();
            Alert.alert('Success', 'All data has been cleared.');
          },
        },
      ]
    );
  };

  return <Settings onClearData={handleClearData} />;
}

function MainTabs() {
  const { colors } = useTheme();

  return (
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
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AudioProvider>
        <NavigationContainer>
          <MainTabs />
          <StatusBar style="auto" />
        </NavigationContainer>
      </AudioProvider>
    </ThemeProvider>
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
});
