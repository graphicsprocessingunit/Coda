import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  StyleSheet,
  Text,
  Pressable,
  FlatList,
  TextInput,
  Modal,
  ScrollView,
  Alert,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import {
  useAudio,
  useDownloadProgress,
  useBatchDownloads,
  TrackMetadata,
} from '../context/AudioContext';
import { TrackList } from './TrackList';
import { NavidromeBrowser } from './NavidromeBrowser';
import { EmptyState } from './EmptyState';
import { Toast } from './Toast';
import { OfflineCacheService } from '../services/OfflineCacheService';
import { FilePickerService } from '../services/FilePickerService';
import { buildLibraryIndex, AlbumGroup, ArtistGroup } from '../services/LibraryGrouping';
import { searchLibrary, hasResults, SearchResults } from '../services/SearchService';

type LibraryTab = 'songs' | 'albums' | 'artists';

interface LibraryViewProps {
  onAlbumPress: (albumKey: string) => void;
  onArtistPress: (artistKey: string) => void;
}

function ArtworkThumb({ uri, size = 48, radius = 6, colors }: { uri?: string; size?: number; radius?: number; colors: any }) {
  if (uri) {
    return <Image source={{ uri }} style={{ width: size, height: size, borderRadius: radius }} cachePolicy="memory-disk" />;
  }
  return (
    <View style={{ width: size, height: size, borderRadius: radius, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.card }}>
      <Ionicons name="musical-note" size={size * 0.45} color={colors.textSecondary} />
    </View>
  );
}

export function LibraryView({ onAlbumPress, onArtistPress }: LibraryViewProps) {
  const {
    library,
    currentTrack,
    playFromLibrary,
    addToLibrary,
    removeFromLibrary,
    downloadTrackForLibrary,
    playlists,
    addTrackToPlaylist,
    createPlaylist,
    playNextInQueue,
    addToQueue,
    toggleFavorite,
    batchToggleFavorite,
    batchRemoveFromLibrary,
    playPlaylist,
  } = useAudio();
  const { activeDownloads } = useDownloadProgress();
  const { batches, startBatchDownload, cancelBatch } = useBatchDownloads();
  const { colors } = useTheme();

  const [tab, setTab] = useState<LibraryTab>('songs');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [showNavidrome, setShowNavidrome] = useState(false);
  const [selectedTrack, setSelectedTrack] = useState<TrackMetadata | null>(null);
  const [showPlaylistModal, setShowPlaylistModal] = useState(false);
  const [showCreateFromLibraryModal, setShowCreateFromLibraryModal] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [batchUris, setBatchUris] = useState<string[] | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [batchToast, setBatchToast] = useState<{ message: string; type: 'error' | 'success' | 'info' } | null>(null);
  const [lastSelectionBatch, setLastSelectionBatch] = useState<any>(null);

  const selectionBatch = batches.get('library-selection');

  useEffect(() => {
    if (!selectionBatch || selectionBatch.running) return;
    if (lastSelectionBatch === selectionBatch) return;
    setLastSelectionBatch(selectionBatch);
    if (selectionBatch.cancelled) {
      if (selectionBatch.completed > 0) {
        setBatchToast({ message: `Download cancelled — ${selectionBatch.completed} track${selectionBatch.completed > 1 ? 's' : ''} downloaded.`, type: 'info' });
      }
      return;
    }
    if (selectionBatch.failed.length > 0) {
      setBatchToast({ message: `${selectionBatch.completed} downloaded, ${selectionBatch.failed.length} failed. Reselect and tap download to retry.`, type: 'error' });
    } else if (selectionBatch.completed > 0 || selectionBatch.skipped > 0) {
      setBatchToast({
        message: selectionBatch.completed > 0
          ? `Downloaded ${selectionBatch.completed} track${selectionBatch.completed > 1 ? 's' : ''}${selectionBatch.skipped > 0 ? ` (${selectionBatch.skipped} already offline)` : ''}.`
          : `All ${selectionBatch.skipped} track${selectionBatch.skipped > 1 ? 's' : ''} already offline.`,
        type: 'success',
      });
    }
  }, [selectionBatch, lastSelectionBatch]);

  useEffect(() => {
    const handle = setTimeout(() => setDebouncedQuery(searchQuery), 200);
    return () => clearTimeout(handle);
  }, [searchQuery]);

  const index = useMemo(() => buildLibraryIndex(library), [library]);

  const results = useMemo<SearchResults>(
    () =>
      searchLibrary(debouncedQuery, {
        library,
        albums: index.albums,
        artists: index.artists,
        playlists,
      }),
    [debouncedQuery, library, index, playlists]
  );

  const searching = debouncedQuery.trim().length > 0;

  const handleAddTracks = async () => {
    const files = await FilePickerService.pickAudioFiles();
    if (files.length > 0) {
      const tracks = await FilePickerService.filesToTracks(files);
      addToLibrary(tracks);
    }
  };

  const handleTrackLongPress = (track: TrackMetadata) => {
    const isAlreadyDownloading = activeDownloads?.has(track.uri);
    const isDownloadable = track.source === 'navidrome' && track.navidromeId && !OfflineCacheService.isTrackCached(track) && !isAlreadyDownloading;
    const isDownloaded = OfflineCacheService.isTrackCached(track);
    Alert.alert(track.title, track.artist, [
      { text: 'Play Next', onPress: () => playNextInQueue(track) },
      { text: 'Add to Queue', onPress: () => addToQueue(track) },
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
      ...(isDownloadable ? [{
        text: 'Download for Offline',
        onPress: async () => {
          const error = await downloadTrackForLibrary(track);
          if (error) setDownloadError(error);
          else Alert.alert('Downloaded', `"${track.title}" is now available offline.`);
        },
      }] : []),
      ...(isDownloaded ? [{ text: 'Downloaded ✓', onPress: () => {} }] : []),
      { text: 'Cancel', style: 'cancel' as const },
    ]);
  };

  const handleBatchDownload = (tracks: TrackMetadata[]) => {
    startBatchDownload(tracks, 'Download selection', 'library-selection');
  };

  const confirmBatchRemove = (uris: string[]) => {
    Alert.alert(
      'Remove Tracks',
      `Remove ${uris.length} track${uris.length > 1 ? 's' : ''} from library?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: () => batchRemoveFromLibrary(uris) },
      ]
    );
  };

  const handleAddToPlaylist = (playlistId: string) => {
    if (batchUris) {
      batchUris.forEach((uri) => {
        const track = library.find((t) => t.uri === uri);
        if (track) addTrackToPlaylist(playlistId, track);
      });
      setBatchUris(null);
    } else if (selectedTrack) {
      addTrackToPlaylist(playlistId, selectedTrack);
      setSelectedTrack(null);
    }
    setShowPlaylistModal(false);
  };

  const handleConfirmCreatePlaylist = () => {
    if (!newPlaylistName.trim()) return;
    const newId = createPlaylist(newPlaylistName.trim());
    if (batchUris) {
      batchUris.forEach((uri) => {
        const track = library.find((t) => t.uri === uri);
        if (track) addTrackToPlaylist(newId, track);
      });
      setBatchUris(null);
    } else if (selectedTrack) {
      addTrackToPlaylist(newId, selectedTrack);
      setSelectedTrack(null);
    }
    setShowPlaylistModal(false);
    setShowCreateFromLibraryModal(false);
    setNewPlaylistName('');
  };

  const openCreatePlaylist = () => {
    setNewPlaylistName('');
    setShowCreateFromLibraryModal(true);
  };

  const renderAlbum = ({ item }: { item: AlbumGroup }) => (
    <Pressable style={styles.albumCard} onPress={() => onAlbumPress(item.key)}>
      {item.artUri ? (
        <Image source={{ uri: item.artUri }} style={styles.albumArt} cachePolicy="memory-disk" />
      ) : (
        <View style={[styles.albumArt, styles.albumArtPlaceholder, { backgroundColor: colors.card }]}>
          <Ionicons name="disc" size={40} color={colors.textSecondary} />
        </View>
      )}
      <Text style={[styles.albumName, { color: colors.text }]} numberOfLines={1}>{item.album}</Text>
      <Text style={[styles.albumMeta, { color: colors.textSecondary }]} numberOfLines={1}>
        {item.albumArtist}{item.year ? `  ·  ${item.year}` : ''}
      </Text>
    </Pressable>
  );

  const renderArtist = ({ item }: { item: ArtistGroup }) => (
    <Pressable
      style={[styles.artistRow, { borderBottomColor: colors.border }]}
      onPress={() => onArtistPress(item.key)}
    >
      {item.artUri ? (
        <Image source={{ uri: item.artUri }} style={styles.artistArt} cachePolicy="memory-disk" />
      ) : (
        <View style={[styles.artistArt, styles.artistArtPlaceholder, { backgroundColor: colors.card }]}>
          <Ionicons name="person" size={24} color={colors.textSecondary} />
        </View>
      )}
      <View style={styles.artistInfo}>
        <Text style={[styles.artistName, { color: colors.text }]} numberOfLines={1}>{item.artist}</Text>
        <Text style={[styles.artistMeta, { color: colors.textSecondary }]} numberOfLines={1}>
          {item.albums.length} {item.albums.length === 1 ? 'album' : 'albums'}  ·  {item.trackCount} {item.trackCount === 1 ? 'song' : 'songs'}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
    </Pressable>
  );

  const renderSearchResults = () => {
    if (!hasResults(results)) {
      return (
        <EmptyState
          icon="search"
          decorativeIcons={[{ name: 'close-circle-outline', offset: { x: 25, y: -20 }, size: 18, delay: 400 }]}
          title="No matches"
          subtitle="Try a different search"
        />
      );
    }
    return (
      <ScrollView contentContainerStyle={styles.resultsContent} keyboardShouldPersistTaps="handled">
        {results.songs.length > 0 && (
          <>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Songs</Text>
            {results.songs.map((track) => (
              <Pressable key={`song-${track.uri}`} style={styles.resultRow} onPress={() => playFromLibrary(track)}>
                <ArtworkThumb uri={track.artwork} colors={colors} />
                <View style={styles.resultInfo}>
                  <Text style={[styles.resultTitle, { color: colors.text }]} numberOfLines={1}>{track.title}</Text>
                  <Text style={[styles.resultSub, { color: colors.textSecondary }]} numberOfLines={1}>{track.artist}</Text>
                </View>
              </Pressable>
            ))}
          </>
        )}
        {results.albums.length > 0 && (
          <>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Albums</Text>
            {results.albums.map((album) => (
              <Pressable key={`album-${album.key}`} style={styles.resultRow} onPress={() => onAlbumPress(album.key)}>
                <ArtworkThumb uri={album.artUri} colors={colors} />
                <View style={styles.resultInfo}>
                  <Text style={[styles.resultTitle, { color: colors.text }]} numberOfLines={1}>{album.album}</Text>
                  <Text style={[styles.resultSub, { color: colors.textSecondary }]} numberOfLines={1}>{album.albumArtist}</Text>
                </View>
              </Pressable>
            ))}
          </>
        )}
        {results.artists.length > 0 && (
          <>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Artists</Text>
            {results.artists.map((artist) => (
              <Pressable key={`artist-${artist.key}`} style={styles.resultRow} onPress={() => onArtistPress(artist.key)}>
                <View style={[styles.resultArtistIcon, { backgroundColor: colors.card }]}>
                  <Ionicons name="person" size={22} color={colors.textSecondary} />
                </View>
                <View style={styles.resultInfo}>
                  <Text style={[styles.resultTitle, { color: colors.text }]} numberOfLines={1}>{artist.artist}</Text>
                  <Text style={[styles.resultSub, { color: colors.textSecondary }]} numberOfLines={1}>
                    {artist.albums.length} {artist.albums.length === 1 ? 'album' : 'albums'}
                  </Text>
                </View>
              </Pressable>
            ))}
          </>
        )}
        {results.playlists.length > 0 && (
          <>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Playlists</Text>
            {results.playlists.map((playlist) => (
              <Pressable key={`playlist-${playlist.id}`} style={styles.resultRow} onPress={() => playPlaylist(playlist)}>
                <View style={[styles.resultArtistIcon, { backgroundColor: colors.card }]}>
                  <Ionicons name="list" size={22} color={colors.textSecondary} />
                </View>
                <View style={styles.resultInfo}>
                  <Text style={[styles.resultTitle, { color: colors.text }]} numberOfLines={1}>{playlist.name}</Text>
                  <Text style={[styles.resultSub, { color: colors.textSecondary }]} numberOfLines={1}>
                    {playlist.tracks.length} {playlist.tracks.length === 1 ? 'track' : 'tracks'}
                  </Text>
                </View>
              </Pressable>
            ))}
          </>
        )}
      </ScrollView>
    );
  };

  const renderTabContent = () => {
    if (searching) return renderSearchResults();
    if (library.length === 0) {
      return (
        <TrackList
          tracks={library}
          currentTrack={currentTrack}
          onTrackPress={playFromLibrary}
          onAddTracks={handleAddTracks}
          showHeader={false}
          showSearch={false}
          onConnectNavidrome={() => setShowNavidrome(true)}
        />
      );
    }
    if (tab === 'songs') {
      return (
        <TrackList
          tracks={library}
          currentTrack={currentTrack}
          onTrackPress={playFromLibrary}
          onAddTracks={handleAddTracks}
          onTrackLongPress={handleTrackLongPress}
          onRemoveTrack={removeFromLibrary}
          onToggleFavorite={toggleFavorite}
          onBatchFavorite={batchToggleFavorite}
          onBatchRemove={confirmBatchRemove}
          onBatchAddToPlaylist={(uris) => { setBatchUris(uris); setShowPlaylistModal(true); }}
          onBatchDownload={handleBatchDownload}
          onDownload={downloadTrackForLibrary}
          showHeader={false}
          showSearch={false}
          onConnectNavidrome={() => setShowNavidrome(true)}
        />
      );
    }
    if (tab === 'albums') {
      if (index.albums.length === 0) {
        return <EmptyState icon="disc" title="No albums" subtitle="Your library has no albums yet." />;
      }
      return (
        <FlatList
          key="albums"
          data={index.albums}
          renderItem={renderAlbum}
          keyExtractor={(item) => item.key}
          numColumns={2}
          columnWrapperStyle={styles.albumRow}
          contentContainerStyle={styles.gridContent}
        />
      );
    }
    if (index.artists.length === 0) {
      return <EmptyState icon="person" title="No artists" subtitle="Your library has no artists yet." />;
    }
    return (
      <FlatList
        key="artists"
        data={index.artists}
        renderItem={renderArtist}
        keyExtractor={(item) => item.key}
        contentContainerStyle={styles.gridContent}
      />
    );
  };

  const tabs: { key: LibraryTab; label: string }[] = [
    { key: 'songs', label: 'Songs' },
    { key: 'albums', label: 'Albums' },
    { key: 'artists', label: 'Artists' },
  ];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Library</Text>
        <View style={styles.headerButtons}>
          <Pressable style={styles.headerButton} onPress={() => setShowNavidrome(true)}>
            <Ionicons name="server-outline" size={24} color={colors.textSecondary} />
          </Pressable>
          <Pressable style={styles.headerButton} onPress={handleAddTracks}>
            <Ionicons name="add-circle" size={24} color={colors.accent} />
          </Pressable>
        </View>
      </View>

      {library.length > 0 && !searching && (
        <View style={[styles.tabBar, { borderBottomColor: colors.border }]}>
          {tabs.map((t) => {
            const active = tab === t.key;
            return (
              <Pressable
                key={t.key}
                style={[styles.tabItem, active && { borderBottomColor: colors.accent }]}
                onPress={() => setTab(t.key)}
              >
                <Text style={[styles.tabLabel, { color: active ? colors.accent : colors.textSecondary }]}>{t.label}</Text>
              </Pressable>
            );
          })}
        </View>
      )}

      {library.length > 0 && (
        <View style={[styles.searchContainer, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
          <Ionicons name="search" size={18} color={colors.textSecondary} style={styles.searchIcon} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="Search songs, albums, artists…"
            placeholderTextColor={colors.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCorrect={false}
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <Pressable onPress={() => setSearchQuery('')} hitSlop={8}>
              <Ionicons name="close-circle" size={18} color={colors.textSecondary} />
            </Pressable>
          )}
        </View>
      )}

      <View style={styles.content}>{renderTabContent()}</View>

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
            <NavidromeBrowser
              mode="addToLibrary"
              onAddTracks={(newTracks) => {
                addToLibrary(newTracks);
                setShowNavidrome(false);
              }}
            />
          </View>
        </View>
      </Modal>

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
                <Pressable style={[modalStyles.createButton, { backgroundColor: colors.accent }]} onPress={openCreatePlaylist}>
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
                setBatchUris(null);
              }}
            >
              <Text style={[modalStyles.cancelButtonText, { color: colors.text }]}>Cancel</Text>
            </Pressable>
            {playlists.length > 0 && (
              <Pressable style={[modalStyles.newPlaylistButton, { backgroundColor: colors.border }]} onPress={openCreatePlaylist}>
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
        <Pressable
          style={modalStyles.modalOverlay}
          onPress={() => {
            setShowCreateFromLibraryModal(false);
            setNewPlaylistName('');
          }}
        >
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
              <Pressable style={[modalStyles.modalButton, { backgroundColor: colors.accent }]} onPress={handleConfirmCreatePlaylist}>
                <Text style={[modalStyles.modalButtonText, { color: colors.onAccent }]}>Create</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {downloadError && <Toast message={downloadError} type="error" onDismiss={() => setDownloadError(null)} />}
      {batchToast && <Toast message={batchToast.message} type={batchToast.type} onDismiss={() => setBatchToast(null)} />}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 32, fontWeight: '700' },
  headerButtons: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  headerButton: { padding: 8 },
  tabBar: { flexDirection: 'row', borderBottomWidth: 1 },
  tabItem: { flex: 1, alignItems: 'center', paddingVertical: 12, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabLabel: { fontSize: 15, fontWeight: '600' },
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
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, paddingVertical: 10, fontSize: 16 },
  content: { flex: 1 },
  gridContent: { paddingVertical: 12, paddingHorizontal: 12 },
  albumRow: { gap: 12 },
  albumCard: { flex: 1, marginBottom: 20 },
  albumArt: { width: '100%', aspectRatio: 1, borderRadius: 8 },
  albumArtPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  albumName: { fontSize: 15, fontWeight: '600', marginTop: 8 },
  albumMeta: { fontSize: 13, marginTop: 2 },
  artistRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  artistArt: { width: 52, height: 52, borderRadius: 26, marginRight: 14 },
  artistArtPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  artistInfo: { flex: 1, marginRight: 8 },
  artistName: { fontSize: 16, fontWeight: '600', marginBottom: 3 },
  artistMeta: { fontSize: 13 },
  resultsContent: { paddingVertical: 8, paddingBottom: 120 },
  sectionTitle: { fontSize: 18, fontWeight: '700', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 },
  resultRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 8 },
  resultArtistIcon: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  resultInfo: { flex: 1, marginLeft: 12 },
  resultTitle: { fontSize: 16, fontWeight: '600', marginBottom: 2 },
  resultSub: { fontSize: 13 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.5)', justifyContent: 'center' },
  modalContent: { borderRadius: 20, marginHorizontal: 20, maxHeight: '80%', flex: 1 },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  modalTitle: { fontSize: 22, fontWeight: '700' },
});

const modalStyles = StyleSheet.create({
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.5)', justifyContent: 'flex-end' },
  modalContent: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '80%' },
  modalTitle: { fontSize: 24, fontWeight: '700', marginBottom: 16 },
  playlistList: { maxHeight: 320 },
  playlistItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  playlistName: { fontSize: 16, fontWeight: '600' },
  playlistCount: { fontSize: 13 },
  emptyState: { alignItems: 'center', paddingVertical: 24 },
  emptyText: { fontSize: 15, marginBottom: 16 },
  createButton: { paddingHorizontal: 20, paddingVertical: 12, borderRadius: 8 },
  createButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
  cancelButton: { borderRadius: 8, paddingVertical: 12, alignItems: 'center', marginTop: 12 },
  cancelButtonText: { fontSize: 16, fontWeight: '600' },
  newPlaylistButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 8,
    paddingVertical: 12,
    marginTop: 8,
  },
  newPlaylistText: { fontSize: 15, fontWeight: '600' },
  input: { borderRadius: 8, padding: 12, fontSize: 16, marginBottom: 16 },
  modalButtons: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12 },
  modalButton: { paddingVertical: 12, paddingHorizontal: 24, borderRadius: 8 },
  modalButtonText: { fontSize: 16, fontWeight: '600' },
});
