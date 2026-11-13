import type {
  SmartPlaylist,
  SmartPlaylistRule,
  TrackMetadata,
} from '../src/context/AudioContext';
import { evaluateSmartPlaylist } from '../src/services/SmartPlaylistEngine';

const track = (title: string, overrides: Partial<TrackMetadata> = {}): TrackMetadata => ({
  title,
  artist: 'Artist',
  uri: `file:///music/${title}.mp3`,
  ...overrides,
});

const playlist = (
  rules: SmartPlaylistRule[],
  overrides: Partial<SmartPlaylist> = {}
): SmartPlaylist => ({
  id: 'sp_test',
  name: 'Test',
  rules,
  createdAt: 1,
  ...overrides,
});

describe('evaluateSmartPlaylist rules', () => {
  it('returns the whole library, title-sorted, when there are no rules', () => {
    const library = [track('Zebra'), track('Apple'), track('Mango')];
    const result = evaluateSmartPlaylist(library, playlist([]));
    expect(result.map((entry) => entry.title)).toEqual(['Apple', 'Mango', 'Zebra']);
  });

  it('requires every rule to match', () => {
    const library = [
      track('A', { artist: 'Radiohead', playCount: 10 }),
      track('B', { artist: 'Radiohead', playCount: 2 }),
      track('C', { artist: 'Portishead', playCount: 10 }),
    ];
    const result = evaluateSmartPlaylist(
      library,
      playlist([
        { field: 'artist', op: 'eq', value: 'radiohead' },
        { field: 'playCount', op: 'gte', value: 5 },
      ])
    );
    expect(result.map((entry) => entry.title)).toEqual(['A']);
  });

  it('treats a missing play count as zero', () => {
    const library = [track('Never played'), track('Played', { playCount: 4 })];
    const result = evaluateSmartPlaylist(
      library,
      playlist([{ field: 'playCount', op: 'lte', value: 0 }])
    );
    expect(result.map((entry) => entry.title)).toEqual(['Never played']);
  });

  it('supports gte, lte and eq on play count', () => {
    const library = [
      track('One', { playCount: 1 }),
      track('Five', { playCount: 5 }),
      track('Nine', { playCount: 9 }),
    ];
    const titles = (rule: SmartPlaylistRule) =>
      evaluateSmartPlaylist(library, playlist([rule])).map((entry) => entry.title);

    expect(titles({ field: 'playCount', op: 'gte', value: 5 })).toEqual(['Five', 'Nine']);
    expect(titles({ field: 'playCount', op: 'lte', value: 5 })).toEqual(['Five', 'One']);
    expect(titles({ field: 'playCount', op: 'eq', value: 5 })).toEqual(['Five']);
  });

  it('matches favorites, including tracks with the flag unset', () => {
    const library = [
      track('Loved', { isFavorite: true }),
      track('Plain'),
      track('Unloved', { isFavorite: false }),
    ];
    const favorites = evaluateSmartPlaylist(
      library,
      playlist([{ field: 'isFavorite', op: 'eq', value: true }])
    );
    const others = evaluateSmartPlaylist(
      library,
      playlist([{ field: 'isFavorite', op: 'eq', value: false }])
    );

    expect(favorites.map((entry) => entry.title)).toEqual(['Loved']);
    expect(others.map((entry) => entry.title)).toEqual(['Plain', 'Unloved']);
  });

  it('matches artist and album case-insensitively, with contains', () => {
    const library = [
      track('A', { artist: 'The National', album: 'Boxer' }),
      track('B', { artist: 'National Youth', album: 'Other' }),
    ];
    const containsArtist = evaluateSmartPlaylist(
      library,
      playlist([{ field: 'artist', op: 'contains', value: 'NATIONAL' }])
    );
    const exactAlbum = evaluateSmartPlaylist(
      library,
      playlist([{ field: 'album', op: 'eq', value: 'boxer' }])
    );

    expect(containsArtist.map((entry) => entry.title)).toEqual(['A', 'B']);
    expect(exactAlbum.map((entry) => entry.title)).toEqual(['A']);
  });

  it('treats a missing artist or album as empty rather than crashing', () => {
    const library = [track('A', { artist: undefined as unknown as string })];
    const result = evaluateSmartPlaylist(
      library,
      playlist([{ field: 'artist', op: 'contains', value: 'x' }])
    );
    expect(result).toEqual([]);
  });

  it('matches the track source', () => {
    const library = [
      track('Local', { source: 'local' }),
      track('Server', { source: 'navidrome' }),
    ];
    const result = evaluateSmartPlaylist(
      library,
      playlist([{ field: 'source', op: 'eq', value: 'navidrome' }])
    );
    expect(result.map((entry) => entry.title)).toEqual(['Server']);
  });

  it('does not filter out tracks for unknown fields', () => {
    const library = [track('A'), track('B')];
    const rule = { field: 'mystery', op: 'eq', value: 'x' } as unknown as SmartPlaylistRule;
    expect(evaluateSmartPlaylist(library, playlist([rule]))).toHaveLength(2);
  });
});

describe('evaluateSmartPlaylist sorting and limits', () => {
  const counted = [
    track('Two', { playCount: 2 }),
    track('Ten', { playCount: 10 }),
    track('One', { playCount: 1 }),
  ];

  it('sorts by play count descending by default', () => {
    const result = evaluateSmartPlaylist(
      counted,
      playlist([], { sortField: 'playCount' })
    );
    expect(result.map((entry) => entry.title)).toEqual(['Ten', 'Two', 'One']);
  });

  it('honours an explicit direction', () => {
    const result = evaluateSmartPlaylist(
      counted,
      playlist([], { sortField: 'playCount', sortDirection: 'asc' })
    );
    expect(result.map((entry) => entry.title)).toEqual(['One', 'Two', 'Ten']);
  });

  it('sorts by title ascending by default', () => {
    const result = evaluateSmartPlaylist(
      [track('b'), track('A'), track('c')],
      playlist([])
    );
    expect(result.map((entry) => entry.title)).toEqual(['A', 'b', 'c']);
  });

  it('defaults the limit to 50 results', () => {
    const library = Array.from({ length: 60 }, (_, index) => track(`Song ${index}`));
    expect(evaluateSmartPlaylist(library, playlist([]))).toHaveLength(50);
  });

  it('applies an explicit limit, including zero', () => {
    const library = [track('A'), track('B'), track('C')];
    expect(evaluateSmartPlaylist(library, playlist([], { limit: 2 }))).toHaveLength(2);
    expect(evaluateSmartPlaylist(library, playlist([], { limit: 0 }))).toEqual([]);
  });

  it('does not mutate the library order', () => {
    const library = [track('Zebra'), track('Apple')];
    evaluateSmartPlaylist(library, playlist([]));
    expect(library.map((entry) => entry.title)).toEqual(['Zebra', 'Apple']);
  });
});
