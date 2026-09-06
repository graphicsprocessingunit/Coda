import {
  clampIndex,
  fmtDuration,
  filterLibrary,
  screenTitle,
  buildReorderRows,
} from '../src/components/ipod/menus';

const track = (title: string, artist: string, album?: string) => ({
  title,
  artist,
  album,
  uri: `uri:${title}`,
});

describe('clampIndex', () => {
  it('clamps within [0, length-1]', () => {
    expect(clampIndex(0, 5)).toBe(0);
    expect(clampIndex(4, 5)).toBe(4);
    expect(clampIndex(10, 5)).toBe(4);
    expect(clampIndex(-3, 5)).toBe(0);
  });
  it('returns 0 for empty lists', () => {
    expect(clampIndex(0, 0)).toBe(0);
    expect(clampIndex(3, -2)).toBe(0);
  });
});

describe('fmtDuration', () => {
  it('formats seconds as m:ss', () => {
    expect(fmtDuration(0)).toBe('');
    expect(fmtDuration(65)).toBe('1:05');
    expect(fmtDuration(600)).toBe('10:00');
  });
  it('renders empty for missing durations', () => {
    expect(fmtDuration(undefined)).toBe('');
    expect(fmtDuration(NaN)).toBe('');
  });
});

describe('filterLibrary', () => {
  const lib = [
    track('Hello', 'Adele', '25'),
    track('Bohemian Rhapsody', 'Queen', 'A Night at the Opera'),
    track('Halo', 'Beyoncé', 'I Am'),
  ];
  it('matches title case-insensitively', () => {
    expect(filterLibrary(lib, 'hello').length).toBe(1);
    expect(filterLibrary(lib, 'HELLO').length).toBe(1);
  });
  it('matches artist and album', () => {
    expect(filterLibrary(lib, 'queen').length).toBe(1);
    expect(filterLibrary(lib, 'night').length).toBe(1);
  });
  it('returns nothing for empty queries', () => {
    expect(filterLibrary(lib, '')).toEqual([]);
    expect(filterLibrary(lib, '   ')).toEqual([]);
  });
  it('returns nothing when no match', () => {
    expect(filterLibrary(lib, 'zzzz')).toEqual([]);
  });
});

describe('screenTitle', () => {
  it('names known screens', () => {
    expect(screenTitle({ type: 'root', highlight: 0 })).toBe('iPod');
    expect(screenTitle({ type: 'music', highlight: 0 })).toBe('Music');
    expect(screenTitle({ type: 'search', highlight: 0 })).toBe('Search');
  });
  it('uses custom track titles', () => {
    expect(screenTitle({ type: 'tracks', title: 'Favorites', highlight: 0 })).toBe('Favorites');
  });
  it('names navidrome sub-screens', () => {
    expect(screenTitle({ type: 'navidrome', view: 'artists', key: 'a', highlight: 0 })).toBe('Navidrome');
    expect(
      screenTitle({ type: 'navidrome', view: 'albums', key: 'a', artist: { id: 'x', name: 'Queen' }, highlight: 0 })
    ).toBe('Queen');
  });
});

describe('buildReorderRows', () => {
  const tracks = [track('One', 'A'), track('Two', 'A'), track('Three', 'A')];

  it('shows original order before a source is chosen', () => {
    const rows = buildReorderRows(tracks, null, 0);
    expect(rows.map((r) => r.right)).toEqual(['1', '2', '3']);
    expect(rows.some((r) => r.sub === 'MOVE')).toBe(false);
  });

  it('highlights the moving row once a source is chosen', () => {
    const rows = buildReorderRows(tracks, 1, 2);
    const moving = rows.find((r) => r.right === 'MOVE');
    expect(moving).toBeDefined();
  });

  it('keeps row count stable', () => {
    for (const from of [0, 1, 2]) {
      for (let h = 0; h < 3; h++) {
        expect(buildReorderRows(tracks, from, h).length).toBe(3);
      }
    }
  });
});
