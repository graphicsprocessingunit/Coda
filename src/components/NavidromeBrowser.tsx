import React, { useState, useEffect, useMemo } from 'react';
import { View, StyleSheet, Text, Pressable, FlatList, Image, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useAudio, TrackMetadata } from '../context/AudioContext';
import { NavidromeService, NavidromeArtist, NavidromeAlbum, NavidromeSong, NavidromeCredentials } from '../services/NavidromeService';
import { SkeletonLoader } from './SkeletonLoader';
import { EmptyState } from './EmptyState';

type ViewLevel = 'artists' | 'artist-detail' | 'album-detail';

interface NavidromeBrowserProps {
  mode: 'addToLibrary' | 'addToPlaylist';
  onAddTracks: (tracks: TrackMetadata[]) => void;
}

export function NavidromeBrowser({ mode, onAddTracks }: NavidromeBrowserProps) {
  const { colors } = useTheme();
  const { getNavidromeCredentials, navidromeConnected, playFromLibrary } = useAudio();
  const [viewLevel, setViewLevel] = useState<ViewLevel>('artists');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [artists, setArtists] = useState<NavidromeArtist[]>([]);
  const [selectedArtist, setSelectedArtist] = useState<NavidromeArtist | null>(null);
  const [artistAlbums, setArtistAlbums] = useState<NavidromeAlbum[]>([]);
  const [selectedAlbum, setSelectedAlbum] = useState<NavidromeAlbum | null>(null);
  const [albumSongs, setAlbumSongs] = useState<NavidromeSong[]>([]);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{ artists: NavidromeArtist[]; albums: NavidromeAlbum[]; songs: NavidromeSong[] } | null>(null);
  const [searching, setSearching] = useState(false);

  const creds = getNavidromeCredentials();

  useEffect(() => {
    if (!creds || !navidromeConnected) return;
    loadArtists();
  }, [creds, navidromeConnected]);

  useEffect(() => {
    if (!creds || !searchQuery.trim()) {
      setSearchResults(null);
      return;
    }
    const timer = setTimeout(() => {
      performSearch(searchQuery.trim());
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, creds]);

  const loadArtists = async () => {
    if (!creds) return;
    setLoading(true);
    setError('');
    try {
      const data = await NavidromeService.getArtists(creds);
      setArtists(data);
    } catch (e: any) {
      setError(e.message || 'Failed to load artists');
    }
    setLoading(false);
  };

  const loadArtistAlbums = async (artist: NavidromeArtist) => {
    if (!creds) return;
    setLoading(true);
    setError('');
    try {
      const data = await NavidromeService.getArtist(creds, artist.id);
      setSelectedArtist(data.artist);
      setArtistAlbums(data.albums);
      setViewLevel('artist-detail');
    } catch (e: any) {
      setError(e.message || 'Failed to load albums');
    }
    setLoading(false);
  };

  const loadAlbumSongs = async (album: NavidromeAlbum) => {
    if (!creds) return;
    setLoading(true);
    setError('');
    try {
      const data = await NavidromeService.getAlbum(creds, album.id);
      setSelectedAlbum(data.album);
      setAlbumSongs(data.songs);
      setViewLevel('album-detail');
    } catch (e: any) {
      setError(e.message || 'Failed to load songs');
    }
    setLoading(false);
  };

  const performSearch = async (query: string) => {
    if (!creds) return;
    setSearching(true);
    try {
      const results = await NavidromeService.search(creds, query);
      setSearchResults(results);
    } catch {}
    setSearching(false);
  };

  const handleAddSong = (song: NavidromeSong) => {
    if (!creds) return;
    const track = NavidromeService.songToTrackMetadata(creds, song);
    onAddTracks([track]);
  };

  const handlePlaySong = async (song: NavidromeSong, context: NavidromeSong[]) => {
    if (!creds) return;
    const track = NavidromeService.songToTrackMetadata(creds, song);
    const tracks = context.map(s => NavidromeService.songToTrackMetadata(creds, s));
    await playFromLibrary({ ...track });
  };

  const getCoverUrl = (id: string) => {
    if (!creds) return '';
    return NavidromeService.getCoverArtUrl(creds, id, 120);
  };

  const navigateBack = () => {
    if (viewLevel === 'album-detail') {
      setViewLevel('artist-detail');
      setSelectedAlbum(null);
      setAlbumSongs([]);
    } else if (viewLevel === 'artist-detail') {
      setViewLevel('artists');
      setSelectedArtist(null);
      setArtistAlbums([]);
    }
  };

  const renderArtist = ({ item }: { item: NavidromeArtist }) => (
    <Pressable style={[styles.listItem, { borderBottomColor: colors.border }]} onPress={() => loadArtistAlbums(item)}>
      <View style={styles.listItemImage}>
        {item.coverArt ? (
          <Image source={{ uri: getCoverUrl(item.coverArt) }} style={styles.listItemImage} />
        ) : (
          <View style={[styles.placeholderImage, { backgroundColor: colors.card }]}>
            <Ionicons name="person" size={24} color={colors.textSecondary} />
          </View>
        )}
      </View>
      <View style={styles.listItemInfo}>
        <Text style={[styles.listItemTitle, { color: colors.text }]} numberOfLines={1}>{item.name}</Text>
        <Text style={[styles.listItemSubtitle, { color: colors.textSecondary }]}>{item.albumCount || 0} albums</Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
    </Pressable>
  );

  const renderAlbum = ({ item }: { item: NavidromeAlbum }) => (
    <Pressable style={[styles.listItem, { borderBottomColor: colors.border }]} onPress={() => loadAlbumSongs(item)}>
      <View style={styles.listItemImage}>
        {item.coverArt ? (
          <Image source={{ uri: getCoverUrl(item.coverArt) }} style={styles.listItemImage} />
        ) : (
          <View style={[styles.placeholderImage, { backgroundColor: colors.card }]}>
            <Ionicons name="disc" size={24} color={colors.textSecondary} />
          </View>
        )}
      </View>
      <View style={styles.listItemInfo}>
        <Text style={[styles.listItemTitle, { color: colors.text }]} numberOfLines={1}>{item.name}</Text>
        <Text style={[styles.listItemSubtitle, { color: colors.textSecondary }]}>
          {item.artist || 'Unknown'}{item.year ? ` · ${item.year}` : ''}{item.songCount ? ` · ${item.songCount} songs` : ''}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
    </Pressable>
  );

  const renderSong = ({ item, index }: { item: NavidromeSong; index: number }) => (
    <Pressable style={[styles.listItem, { borderBottomColor: colors.border }]} onPress={() => handlePlaySong(item, albumSongs)}>
      <View style={styles.songNumber}>
        <Text style={[styles.songNumberText, { color: colors.textSecondary }]}>{item.track || index + 1}</Text>
      </View>
      <View style={styles.songImage}>
        {item.coverArt ? (
          <Image source={{ uri: getCoverUrl(item.coverArt) }} style={styles.songImage} />
        ) : (
          <View style={[styles.placeholderImage, { backgroundColor: colors.card }]}>
            <Ionicons name="musical-note" size={18} color={colors.textSecondary} />
          </View>
        )}
      </View>
      <View style={styles.listItemInfo}>
        <Text style={[styles.listItemTitle, { color: colors.text }]} numberOfLines={1}>{item.title}</Text>
        <Text style={[styles.listItemSubtitle, { color: colors.textSecondary }]}>{item.artist || 'Unknown Artist'}</Text>
      </View>
      <Pressable hitSlop={8} onPress={() => handleAddSong(item)} style={styles.addButton}>
        <Ionicons name="add-circle" size={28} color={colors.accent} />
      </Pressable>
    </Pressable>
  );

  const renderSearchResultArtist = ({ item }: { item: NavidromeArtist }) => (
    <Pressable style={[styles.listItem, { borderBottomColor: colors.border }]} onPress={() => loadArtistAlbums(item)}>
      <View style={styles.listItemImage}>
        {item.coverArt ? (
          <Image source={{ uri: getCoverUrl(item.coverArt) }} style={styles.listItemImage} />
        ) : (
          <View style={[styles.placeholderImage, { backgroundColor: colors.card }]}>
            <Ionicons name="person" size={24} color={colors.textSecondary} />
          </View>
        )}
      </View>
      <View style={styles.listItemInfo}>
        <Text style={[styles.listItemTitle, { color: colors.text }]} numberOfLines={1}>{item.name}</Text>
        <Text style={[styles.listItemSubtitle, { color: colors.textSecondary }]}>Artist</Text>
      </View>
    </Pressable>
  );

  const renderSearchResultAlbum = ({ item }: { item: NavidromeAlbum }) => (
    <Pressable style={[styles.listItem, { borderBottomColor: colors.border }]} onPress={() => loadAlbumSongs(item)}>
      <View style={styles.listItemImage}>
        {item.coverArt ? (
          <Image source={{ uri: getCoverUrl(item.coverArt) }} style={styles.listItemImage} />
        ) : (
          <View style={[styles.placeholderImage, { backgroundColor: colors.card }]}>
            <Ionicons name="disc" size={24} color={colors.textSecondary} />
          </View>
        )}
      </View>
      <View style={styles.listItemInfo}>
        <Text style={[styles.listItemTitle, { color: colors.text }]} numberOfLines={1}>{item.name}</Text>
        <Text style={[styles.listItemSubtitle, { color: colors.textSecondary }]}>{item.artist || 'Unknown'} · Album</Text>
      </View>
    </Pressable>
  );

  const renderSearchResultSong = ({ item }: { item: NavidromeSong }) => (
    <Pressable style={[styles.listItem, { borderBottomColor: colors.border }]} onPress={() => handlePlaySong(item, searchResults?.songs || [])}>
      <View style={styles.listItemImage}>
        {item.coverArt ? (
          <Image source={{ uri: getCoverUrl(item.coverArt) }} style={styles.listItemImage} />
        ) : (
          <View style={[styles.placeholderImage, { backgroundColor: colors.card }]}>
            <Ionicons name="musical-note" size={24} color={colors.textSecondary} />
          </View>
        )}
      </View>
      <View style={styles.listItemInfo}>
        <Text style={[styles.listItemTitle, { color: colors.text }]} numberOfLines={1}>{item.title}</Text>
        <Text style={[styles.listItemSubtitle, { color: colors.textSecondary }]}>{item.artist || 'Unknown Artist'} · Song</Text>
      </View>
      <Pressable hitSlop={8} onPress={() => handleAddSong(item)} style={styles.addButton}>
        <Ionicons name="add-circle" size={28} color={colors.accent} />
      </Pressable>
    </Pressable>
  );

  if (!navidromeConnected) {
    return (
      <EmptyState
        icon="cloud-offline-outline"
        decorativeIcons={[
          { name: 'wifi-outline', offset: { x: 35, y: -25 }, size: 18, delay: 400 },
          { name: 'server-outline', offset: { x: -35, y: 20 }, size: 16, delay: 600 },
        ]}
        title="Not connected to Navidrome"
        subtitle="Connect in Settings to browse your music"
      />
    );
  }

  const getBreadcrumb = () => {
    const crumbs: { label: string; onPress?: () => void }[] = [{ label: 'Artists', onPress: viewLevel !== 'artists' ? navigateBack : undefined }];
    if (viewLevel === 'artist-detail' && selectedArtist) {
      crumbs.push({ label: selectedArtist.name, onPress: navigateBack });
    }
    if (viewLevel === 'album-detail' && selectedAlbum) {
      crumbs.push({ label: selectedAlbum.name });
    }
    return crumbs;
  };

  return (
    <View style={styles.container}>
      <View style={[styles.searchContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Ionicons name="search" size={20} color={colors.textSecondary} />
        <TextInput
          style={[styles.searchInput, { color: colors.text }]}
          placeholder="Search artists, albums, songs..."
          placeholderTextColor={colors.textSecondary}
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {searchQuery.length > 0 && (
          <Pressable hitSlop={8} onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={20} color={colors.textSecondary} />
          </Pressable>
        )}
      </View>

      {viewLevel !== 'artists' && !searchQuery && (
        <View style={styles.breadcrumbContainer}>
          {getBreadcrumb().map((crumb, i, arr) => (
            <View key={i} style={styles.breadcrumbItem}>
              {crumb.onPress ? (
                <Pressable onPress={crumb.onPress}>
                  <Text style={[styles.breadcrumbText, { color: colors.accent }]}>{crumb.label}</Text>
                </Pressable>
              ) : (
                <Text style={[styles.breadcrumbTextActive, { color: colors.text }]}>{crumb.label}</Text>
              )}
              {i < arr.length - 1 && (
                <Ionicons name="chevron-forward" size={14} color={colors.textSecondary} style={styles.breadcrumbSeparator} />
              )}
            </View>
          ))}
        </View>
      )}

      {loading ? (
        <SkeletonLoader variant="trackRow" count={5} />
      ) : error ? (
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={48} color="#FF3B30" />
          <Text style={[styles.errorText, { color: colors.text }]}>{error}</Text>
        </View>
      ) : searchQuery ? (
        <FlatList
          data={[]}
          renderItem={() => null}
          ListHeaderComponent={
            <View>
              {searching ? (
                <SkeletonLoader variant="trackRow" count={3} />
              ) : searchResults ? (
                <>
                  {searchResults.songs.length > 0 && (
                    <View style={styles.resultSection}>
                      <Text style={[styles.resultSectionTitle, { color: colors.textSecondary }]}>Songs</Text>
                      <FlatList
                        data={searchResults.songs}
                        renderItem={renderSearchResultSong}
                        keyExtractor={(item) => item.id}
                        scrollEnabled={false}
                      />
                    </View>
                  )}
                  {searchResults.albums.length > 0 && (
                    <View style={styles.resultSection}>
                      <Text style={[styles.resultSectionTitle, { color: colors.textSecondary }]}>Albums</Text>
                      <FlatList
                        data={searchResults.albums}
                        renderItem={renderSearchResultAlbum}
                        keyExtractor={(item) => item.id}
                        scrollEnabled={false}
                      />
                    </View>
                  )}
                  {searchResults.artists.length > 0 && (
                    <View style={styles.resultSection}>
                      <Text style={[styles.resultSectionTitle, { color: colors.textSecondary }]}>Artists</Text>
                      <FlatList
                        data={searchResults.artists}
                        renderItem={renderSearchResultArtist}
                        keyExtractor={(item) => item.id}
                        scrollEnabled={false}
                      />
                    </View>
                  )}
                  {!searchResults.songs.length && !searchResults.albums.length && !searchResults.artists.length && (
                    <EmptyState
                      icon="search-outline"
                      decorativeIcons={[
                        { name: 'close-circle-outline', offset: { x: 25, y: -20 }, size: 16, delay: 400 },
                      ]}
                      title="No results found"
                    />
                  )}
                </>
              ) : null}
            </View>
          }
          keyExtractor={() => 'dummy'}
        />
      ) : (
        <FlatList
          data={(viewLevel === 'artists' ? artists : viewLevel === 'artist-detail' ? artistAlbums : albumSongs) as any[]}
          renderItem={({ item, index }) => {
            if (viewLevel === 'artists') return renderArtist({ item: item as unknown as NavidromeArtist });
            if (viewLevel === 'artist-detail') return renderAlbum({ item: item as unknown as NavidromeAlbum });
            return renderSong({ item: item as unknown as NavidromeSong, index });
          }}
          keyExtractor={(item) => (item as any).id}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <EmptyState
              icon="musical-notes-outline"
              decorativeIcons={[
                { name: 'folder-outline', offset: { x: -25, y: 15 }, size: 16, delay: 400 },
                { name: 'disc-outline', offset: { x: 25, y: -15 }, size: 16, delay: 600 },
              ]}
              title="No items found"
            />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    fontSize: 15,
  },
  breadcrumbContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
  },
  breadcrumbItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  breadcrumbText: {
    fontSize: 14,
    fontWeight: '500',
  },
  breadcrumbTextActive: {
    fontSize: 14,
    fontWeight: '700',
  },
  breadcrumbSeparator: {
    marginHorizontal: 6,
  },
  listContent: {
    paddingBottom: 20,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  listItemImage: {
    width: 48,
    height: 48,
    borderRadius: 6,
    marginRight: 12,
    overflow: 'hidden',
  },
  placeholderImage: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  listItemInfo: {
    flex: 1,
    marginRight: 8,
  },
  listItemTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  listItemSubtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  songNumber: {
    width: 32,
    alignItems: 'center',
    marginRight: 12,
  },
  songNumberText: {
    fontSize: 14,
  },
  songImage: {
    width: 48,
    height: 48,
    borderRadius: 6,
    marginRight: 12,
    overflow: 'hidden',
  },
  addButton: {
    padding: 4,
  },
  resultSection: {
    marginBottom: 16,
  },
  resultSectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 15,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    marginTop: 12,
    fontSize: 15,
  },
  errorContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  errorText: {
    marginTop: 12,
    fontSize: 15,
  },
  notConnected: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  notConnectedText: {
    marginTop: 12,
    fontSize: 16,
    fontWeight: '600',
  },
  notConnectedHint: {
    marginTop: 6,
    fontSize: 14,
  },
});
