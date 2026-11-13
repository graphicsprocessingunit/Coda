import { StatusBar } from 'expo-status-bar';
import { NavigationContainer, useIsFocused } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import { useState, useEffect, useRef, useMemo } from 'react';
import { Alert, View, Text, Pressable, StyleSheet, Animated, ActivityIndicator, Appearance, Platform } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AudioProvider, useAudio, useDownloadProgress, Playlist, TrackMetadata, SmartPlaylist } from './src/context/AudioContext';
import { ThemeProvider, useTheme } from './src/context/ThemeContext';
import { NowPlayingProvider, useNowPlaying } from './src/context/NowPlayingContext';
import { LibraryView } from './src/components/LibraryView';
import { AlbumDetail } from './src/components/AlbumDetail';
import { ArtistDetail } from './src/components/ArtistDetail';
import { buildLibraryIndex } from './src/services/LibraryGrouping';
import { Playlists } from './src/components/Playlists';
import { PlaylistDetail } from './src/components/PlaylistDetail';
import { SmartPlaylistDetail } from './src/components/SmartPlaylistDetail';
import { evaluateSmartPlaylist } from './src/services/SmartPlaylistEngine';
import { Settings } from './src/components/Settings';
import { NowPlayingSheet } from './src/components/NowPlayingSheet';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import { Toast } from './src/components/Toast';
import { Sidebar } from './src/components/Sidebar';
import { useResponsiveLayout } from './src/hooks/useResponsiveLayout';
import { navigationRef } from './src/navigation/navigationRef';
import { IpodApp } from './src/components/ipod/IpodApp';

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

function PlayerScreen({ navigation }: any) {
  const { open, isExpanded, lastTabRef } = useNowPlaying();
  const isFocused = useIsFocused();
  const wasExpanded = useRef(false);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => open());
    return unsubscribe;
  }, [navigation, open]);

  useEffect(() => {
    if (isExpanded) wasExpanded.current = true;
  }, [isExpanded]);

  useEffect(() => {
    if (isFocused && wasExpanded.current && !isExpanded) {
      wasExpanded.current = false;
      navigation.navigate(lastTabRef.current);
    }
  }, [isExpanded, isFocused, navigation, lastTabRef]);

  return <View style={{ flex: 1 }} />;
}

function LibraryScreen({ navigation }: any) {
  return (
    <LibraryView
      onAlbumPress={(albumKey) => navigation.navigate('AlbumDetail', { albumKey })}
      onArtistPress={(artistKey) => navigation.navigate('ArtistDetail', { artistKey })}
    />
  );
}

function AlbumDetailScreen({ route, navigation }: any) {
  const { library, currentTrack } = useAudio();
  const { albumKey } = route.params;
  const album = useMemo(() => buildLibraryIndex(library).albums.find((a) => a.key === albumKey), [library, albumKey]);

  if (!album) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: '#8E8E93' }}>Album not found</Text>
      </View>
    );
  }

  return <AlbumDetail album={album} currentTrack={currentTrack} onBack={() => navigation.goBack()} />;
}

function ArtistDetailScreen({ route, navigation }: any) {
  const { library, currentTrack } = useAudio();
  const { artistKey } = route.params;
  const artist = useMemo(() => buildLibraryIndex(library).artists.find((a) => a.key === artistKey), [library, artistKey]);

  if (!artist) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: '#8E8E93' }}>Artist not found</Text>
      </View>
    );
  }

  return (
    <ArtistDetail
      artist={artist}
      currentTrack={currentTrack}
      onBack={() => navigation.goBack()}
      onAlbumPress={(key) => navigation.navigate('AlbumDetail', { albumKey: key })}
    />
  );
}

function LibraryStack() {
  return (
    <View style={{ flex: 1 }}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="LibraryHome" component={LibraryScreen} />
        <Stack.Screen name="AlbumDetail" component={AlbumDetailScreen} />
        <Stack.Screen name="ArtistDetail" component={ArtistDetailScreen} />
      </Stack.Navigator>
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
    addTrackToPlaylist,
    smartPlaylists,
    createSmartPlaylist,
    deleteSmartPlaylist,
    library,
  } = useAudio();

  const handlePlaylistPress = (playlist: Playlist) => {
    navigation.navigate('PlaylistDetail', { playlistId: playlist.id });
  };

  const handleSmartPlaylistPress = (playlist: SmartPlaylist) => {
    navigation.navigate('SmartPlaylistDetail', { smartPlaylistId: playlist.id });
  };

  return (
    <Playlists
      playlists={playlists}
      smartPlaylists={smartPlaylists}
      library={library}
      onCreatePlaylist={createPlaylist}
      onDeletePlaylist={deletePlaylist}
      onRenamePlaylist={renamePlaylist}
      onPlayPlaylist={playPlaylist}
      onAddTrackToPlaylist={addTrackToPlaylist}
      onPlaylistPress={handlePlaylistPress}
      onSmartPlaylistPress={handleSmartPlaylistPress}
      onCreateSmartPlaylist={createSmartPlaylist}
      onDeleteSmartPlaylist={deleteSmartPlaylist}
    />
  );
}

function PlaylistDetailScreen({ route, navigation }: any) {
  const { currentTrack, removeTrackFromPlaylist, reorderPlaylistTracks, addTrackToPlaylist, library, playlists, playPlaylist, playFromPlaylist, renamePlaylist, setQueue, loadTrack } = useAudio();
  const { playlistId } = route.params;
  const playlist = playlists.find((p) => p.id === playlistId);

  if (!playlist) {
    return null;
  }

  const handleBatchRemoveFromPlaylist = (uris: string[]) => {
    uris.forEach(uri => removeTrackFromPlaylist(playlist.id, uri));
  };

  const handleBatchPlaySelected = (tracks: TrackMetadata[]) => {
    if (tracks.length === 0) return;
    const remaining = playlist.tracks.filter(t => !tracks.some(st => st.uri === t.uri));
    const firstTrack = tracks[0];
    const rest = tracks.slice(1);
    setQueue([...rest, ...remaining]);
    loadTrack(firstTrack.uri, firstTrack, true);
  };

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
      onBatchRemoveFromPlaylist={handleBatchRemoveFromPlaylist}
      onBatchPlaySelected={handleBatchPlaySelected}
    />
  );
}

function SmartPlaylistDetailScreen({ route, navigation }: any) {
  const { currentTrack, library, smartPlaylists, deleteSmartPlaylist, updateSmartPlaylist, removeFromLibrary, downloadTrackForLibrary, loadTrack, playFromLibrary } = useAudio();
  const { activeDownloads } = useDownloadProgress();
  const { smartPlaylistId } = route.params;
  const playlist = smartPlaylists.find((sp: SmartPlaylist) => sp.id === smartPlaylistId);

  if (!playlist) {
    return null;
  }

  return (
    <SmartPlaylistDetail
      playlist={playlist}
      library={library}
      currentTrack={currentTrack}
      onTrackPress={(track: TrackMetadata) => playFromLibrary(track)}
      onRemoveTrack={(trackUri: string) => removeFromLibrary(trackUri)}
      onBack={() => navigation.goBack()}
      onDelete={() => {
        deleteSmartPlaylist(playlist.id);
        navigation.goBack();
      }}
      onUpdate={updateSmartPlaylist}
      onDownload={downloadTrackForLibrary}
      activeDownloads={activeDownloads}
    />
  );
}

function PlaylistsStack() {
  return (
    <View style={{ flex: 1 }}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="PlaylistsList" component={PlaylistsScreen} />
        <Stack.Screen name="PlaylistDetail" component={PlaylistDetailScreen} />
        <Stack.Screen name="SmartPlaylistDetail" component={SmartPlaylistDetailScreen} />
      </Stack.Navigator>
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

  return (
    <View style={{ flex: 1 }}>
      <Settings onClearData={handleClearData} />
    </View>
  );
}

function MainTabs() {
  const { isTablet } = useResponsiveLayout();
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
    <View style={{ flex: 1, flexDirection: isTablet ? 'row' : 'column' }}>
      <Sidebar />
      <View style={{ flex: 1 }}>
        {error && <Toast message={error} type="error" onDismiss={clearError} />}
        <Tab.Navigator
        initialRouteName="Library"
        screenOptions={{
          headerShown: false,
          tabBarStyle: isTablet
            ? { display: 'none' }
            : {
                backgroundColor: colors.tabBar,
                borderTopColor: colors.border,
                borderTopWidth: 1,
              },
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
        component={LibraryStack}
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
        <NowPlayingSheet />
      </View>
    </View>
  );
}

function ThemedStatusBar() {
  const { isDark } = useTheme();

  // iOS 27 no longer honours the legacy `UIApplication.setStatusBarStyle:` that expo-status-bar
  // calls, and instead derives the bar from the window's interface style. Overriding that makes
  // the icons follow the app theme again; older iOS versions still apply the explicit style.
  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    Appearance.setColorScheme(isDark ? 'dark' : 'light');
  }, [isDark]);

  return <StatusBar style={isDark ? 'light' : 'dark'} />;
}

export default function App() {
  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <ThemeProvider>
            <AudioProvider>
              <NowPlayingProvider>
                <RootLayout />
              </NowPlayingProvider>
            </AudioProvider>
          </ThemeProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}

function RootLayout() {
  const { layout } = useTheme();
  const { lastTabRef } = useNowPlaying();
  if (layout === 'ipod') {
    return (
      <>
        <IpodApp />
        <ThemedStatusBar />
      </>
    );
  }
  return (
    <NavigationContainer
      ref={navigationRef}
      onStateChange={(state) => {
        if (!state) return;
        const route = state.routes[state.index];
        if (route && route.name !== 'Player') {
          lastTabRef.current = route.name;
        }
      }}
    >
      <MainTabs />
      <ThemedStatusBar />
    </NavigationContainer>
  );
}
