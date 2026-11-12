import { Playlist, TrackMetadata } from '../context/AudioContext';
import { AlbumGroup, ArtistGroup } from './LibraryGrouping';

export interface SearchResults {
  songs: TrackMetadata[];
  albums: AlbumGroup[];
  artists: ArtistGroup[];
  playlists: Playlist[];
}

export const EMPTY_SEARCH_RESULTS: SearchResults = {
  songs: [],
  albums: [],
  artists: [],
  playlists: [],
};

export interface SearchOptions {
  library: TrackMetadata[];
  albums: AlbumGroup[];
  artists: ArtistGroup[];
  playlists: Playlist[];
  limit?: number;
}

export function normalizeForSearch(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function matches(haystack: string | undefined, needle: string): boolean {
  if (!haystack) return false;
  return normalizeForSearch(haystack).includes(needle);
}

export function searchLibrary(rawQuery: string, options: SearchOptions): SearchResults {
  const query = normalizeForSearch(rawQuery);
  if (!query) return EMPTY_SEARCH_RESULTS;

  const limit = options.limit ?? 50;

  const songs = options.library
    .filter(
      (track) =>
        matches(track.title, query) ||
        matches(track.artist, query) ||
        matches(track.album, query) ||
        matches(track.albumArtist, query)
    )
    .slice(0, limit);

  const albums = options.albums
    .filter((album) => matches(album.album, query) || matches(album.albumArtist, query))
    .slice(0, limit);

  const artists = options.artists
    .filter((artist) => matches(artist.artist, query))
    .slice(0, limit);

  const playlists = options.playlists
    .filter((playlist) => matches(playlist.name, query))
    .slice(0, limit);

  return { songs, albums, artists, playlists };
}

export function hasResults(results: SearchResults): boolean {
  return (
    results.songs.length > 0 ||
    results.albums.length > 0 ||
    results.artists.length > 0 ||
    results.playlists.length > 0
  );
}
