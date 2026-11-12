import { TrackMetadata, Playlist } from '../src/context/AudioContext';
import { buildLibraryIndex, groupIntoAlbums, groupIntoArtists } from '../src/services/LibraryGrouping';
import { searchLibrary, normalizeForSearch, hasResults, EMPTY_SEARCH_RESULTS } from '../src/services/SearchService';

function track(partial: Partial<TrackMetadata> & { title: string; artist: string }): TrackMetadata {
  return { uri: `file:///${partial.title}`, ...partial };
}

const library: TrackMetadata[] = [
  track({ title: 'Everything In Its Right Place', artist: 'Radiohead', album: 'Kid A', year: 2000 }),
  track({ title: 'Pyramid Song', artist: 'Radiohead', album: 'Amnesiac' }),
  track({ title: 'Bruises', artist: 'Chairlift', album: 'Does You Inspire You' }),
  track({ title: 'Café', artist: 'Beyoncé', album: 'Lemonade' }),
];

const index = buildLibraryIndex(library);
const playlists: Playlist[] = [
  { id: '1', name: 'Road Trip', tracks: [], createdAt: 0 },
  { id: '2', name: 'Focus', tracks: [], createdAt: 0 },
];

const baseOptions = {
  library,
  albums: index.albums,
  artists: index.artists,
  playlists,
};

describe('SearchService', () => {
  it('normalizes case and diacritics', () => {
    expect(normalizeForSearch('Café')).toBe('cafe');
    expect(normalizeForSearch('  BEYONCÉ ')).toBe('beyonce');
  });

  it('returns empty results for empty query', () => {
    expect(searchLibrary('', baseOptions)).toBe(EMPTY_SEARCH_RESULTS);
    expect(searchLibrary('   ', baseOptions)).toBe(EMPTY_SEARCH_RESULTS);
  });

  it('matches songs across title, artist, and album', () => {
    expect(searchLibrary('radiohead', baseOptions).songs).toHaveLength(2);
    expect(searchLibrary('kid a', baseOptions).songs.map((t) => t.title)).toEqual([
      'Everything In Its Right Place',
    ]);
    expect(searchLibrary('pyramid', baseOptions).songs).toHaveLength(1);
  });

  it('matches diacritic-insensitive queries', () => {
    expect(searchLibrary('beyonce', baseOptions).songs.map((t) => t.title)).toEqual(['Café']);
    expect(searchLibrary('cafe', baseOptions).songs.map((t) => t.title)).toEqual(['Café']);
  });

  it('matches albums and artists', () => {
    expect(searchLibrary('kid a', baseOptions).albums.map((a) => a.album)).toEqual(['Kid A']);
    expect(searchLibrary('radio', baseOptions).artists.map((a) => a.artist)).toEqual(['Radiohead']);
  });

  it('matches playlists', () => {
    expect(searchLibrary('trip', baseOptions).playlists.map((p) => p.name)).toEqual(['Road Trip']);
  });

  it('respects the result limit', () => {
    const results = searchLibrary('radiohead', { ...baseOptions, limit: 1 });
    expect(results.songs).toHaveLength(1);
  });

  it('reports whether results exist', () => {
    expect(hasResults(searchLibrary('radiohead', baseOptions))).toBe(true);
    expect(hasResults(searchLibrary('zzzznope', baseOptions))).toBe(false);
  });

  it('exposes grouping via options', () => {
    expect(groupIntoAlbums(library).length).toBe(4);
    expect(groupIntoArtists(library).length).toBe(3);
  });
});
