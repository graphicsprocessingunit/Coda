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

interface FieldWeights {
  exact: number;
  prefix: number;
  wordPrefix: number;
  contains: number;
}

// Field weights encode priority: a song title match beats an artist match, which beats an
// album match. Prefixes beat matches in the middle of a word.
const TITLE_WEIGHTS: FieldWeights = { exact: 100, prefix: 90, wordPrefix: 70, contains: 60 };
const ARTIST_WEIGHTS: FieldWeights = { exact: 80, prefix: 70, wordPrefix: 50, contains: 40 };
const ALBUM_WEIGHTS: FieldWeights = { exact: 60, prefix: 50, wordPrefix: 30, contains: 20 };
const NAME_WEIGHTS: FieldWeights = { exact: 100, prefix: 90, wordPrefix: 70, contains: 60 };

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function scoreField(value: string | undefined, query: string, weights: FieldWeights): number {
  if (!value) return 0;
  const haystack = normalizeForSearch(value);
  if (!haystack) return 0;
  if (haystack === query) return weights.exact;
  if (haystack.startsWith(query)) return weights.prefix;
  if (new RegExp(`(^|[^a-z0-9])${escapeRegExp(query)}`).test(haystack)) return weights.wordPrefix;
  if (haystack.includes(query)) return weights.contains;
  return 0;
}

function scoreTrack(track: TrackMetadata, query: string): number {
  return Math.max(
    scoreField(track.title, query, TITLE_WEIGHTS),
    scoreField(track.artist, query, ARTIST_WEIGHTS),
    scoreField(track.albumArtist, query, ARTIST_WEIGHTS),
    scoreField(track.album, query, ALBUM_WEIGHTS),
  );
}

function rank<T>(
  items: T[],
  score: (item: T) => number,
  label: (item: T) => string,
  limit: number,
): T[] {
  const ranked: { item: T; score: number; label: string }[] = [];
  for (const item of items) {
    const value = score(item);
    if (value > 0) ranked.push({ item, score: value, label: label(item) });
  }
  ranked.sort((a, b) => b.score - a.score || a.label.localeCompare(b.label));
  return ranked.slice(0, limit).map((entry) => entry.item);
}

export function searchLibrary(rawQuery: string, options: SearchOptions): SearchResults {
  const query = normalizeForSearch(rawQuery);
  if (!query) return EMPTY_SEARCH_RESULTS;

  const limit = options.limit ?? 50;

  return {
    songs: rank(
      options.library,
      (track) => scoreTrack(track, query),
      (track) => track.title,
      limit,
    ),
    albums: rank(
      options.albums,
      (album) =>
        Math.max(
          scoreField(album.album, query, NAME_WEIGHTS),
          scoreField(album.albumArtist, query, ARTIST_WEIGHTS),
        ),
      (album) => album.album,
      limit,
    ),
    artists: rank(
      options.artists,
      (artist) => scoreField(artist.artist, query, NAME_WEIGHTS),
      (artist) => artist.artist,
      limit,
    ),
    playlists: rank(
      options.playlists,
      (playlist) => scoreField(playlist.name, query, NAME_WEIGHTS),
      (playlist) => playlist.name,
      limit,
    ),
  };
}

export function hasResults(results: SearchResults): boolean {
  return (
    results.songs.length > 0 ||
    results.albums.length > 0 ||
    results.artists.length > 0 ||
    results.playlists.length > 0
  );
}
