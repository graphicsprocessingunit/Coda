import AsyncStorage from '@react-native-async-storage/async-storage';

import { fetchLyrics, pickLyrics } from '../src/services/LyricsService';

interface FakeRecord {
  syncedLyrics?: string;
  plainLyrics?: string;
  duration?: number;
}

let exactMatch: FakeRecord | null = null;
let searchResponses: FakeRecord[][] = [];
let fetchCalls: string[] = [];

const mockFetch = jest.fn(async (url: string) => {
  fetchCalls.push(url);
  if (url.includes('/api/get')) {
    return exactMatch
      ? { ok: true, json: async () => exactMatch }
      : { ok: false, json: async () => ({}) };
  }
  return { ok: true, json: async () => searchResponses.shift() ?? [] };
});

global.fetch = mockFetch as any;

const query = (durationMs?: number) => ({
  artist: 'Artist',
  title: 'Song',
  album: 'Album',
  durationMs,
});

beforeEach(async () => {
  await AsyncStorage.clear();
  exactMatch = null;
  searchResponses = [];
  fetchCalls = [];
  mockFetch.mockClear();
});

describe('LyricsService', () => {
  describe('fetchLyrics', () => {
    it('returns cached lyrics on second call', async () => {
      searchResponses = [[{ syncedLyrics: '[00:10.00] Hello', duration: 180 }]];

      const first = await fetchLyrics(query(180000));
      expect(first?.lyrics).toBe('[00:10.00] Hello');

      const second = await fetchLyrics(query(180000));
      expect(second?.lyrics).toBe('[00:10.00] Hello');
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('prefers the exact-match endpoint over search results', async () => {
      exactMatch = { syncedLyrics: '[00:10.00] Exact', duration: 181 };
      searchResponses = [[{ syncedLyrics: '[00:10.00] Search', duration: 240 }]];

      const result = await fetchLyrics(query(180000));
      expect(result?.lyrics).toBe('[00:10.00] Exact');
      expect(fetchCalls).toHaveLength(1);
      expect(fetchCalls[0]).toContain('/api/get');
      expect(fetchCalls[0]).toContain('album_name=Album');
      expect(fetchCalls[0]).toContain('duration=180');
    });

    it('returns synced lyrics when available', async () => {
      searchResponses = [
        [
          { syncedLyrics: '[00:01.00] Line 1\n[00:02.00] Line 2', duration: 200 },
          { plainLyrics: 'Plain text', duration: 175 },
        ],
      ];

      const result = await fetchLyrics(query(200000));
      expect(result?.lyrics).toContain('[00:01.00] Line 1');
      expect(result?.sourceDurationMs).toBe(200000);
    });

    it('falls back to plain lyrics when no synced lyrics exist', async () => {
      searchResponses = [[{ plainLyrics: 'No sync available', duration: 180 }]];

      const result = await fetchLyrics(query(180000));
      expect(result?.lyrics).toBe('No sync available');
      expect(result?.sourceDurationMs).toBeUndefined();
    });

    it('returns null when no results are found', async () => {
      await expect(fetchLyrics(query(180000))).resolves.toBeNull();
    });

    it('returns null on fetch error', async () => {
      mockFetch.mockImplementationOnce(async () => {
        throw new Error('Network error');
      });

      await expect(fetchLyrics(query(180000))).resolves.toBeNull();
    });

    it('skips the artist search and exact lookup when the artist is unknown', async () => {
      searchResponses = [[{ syncedLyrics: '[00:00.00] Hi', duration: 120 }]];

      const result = await fetchLyrics({ ...query(120000), artist: 'Unknown Artist' });
      expect(result?.lyrics).toBe('[00:00.00] Hi');
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(fetchCalls[0]).not.toContain('/api/get');
      expect(fetchCalls[0]).not.toContain('artist_name');
    });

    it('selects the closest same-length version', async () => {
      searchResponses = [
        [
          { syncedLyrics: '[00:00.00] Far', duration: 300 },
          { syncedLyrics: '[00:00.00] Close', duration: 182 },
          { syncedLyrics: '[00:00.00] Medium', duration: 200 },
        ],
      ];

      const result = await fetchLyrics(query(180000));
      expect(result?.lyrics).toBe('[00:00.00] Close');
    });

    it('rejects timings from a clearly different recording', async () => {
      searchResponses = [
        [{ syncedLyrics: '[00:00.00] Live version', duration: 120 }],
        [{ syncedLyrics: '[00:00.00] Live version', duration: 120 }],
      ];

      await expect(fetchLyrics(query(270000))).resolves.toBeNull();
    });

    it('refetches when a duration becomes known instead of reusing the unknown-duration match', async () => {
      searchResponses = [
        [{ syncedLyrics: '[00:00.00] First', duration: 100 }],
        [{ syncedLyrics: '[00:00.00] Correct edit', duration: 240 }],
      ];

      const unknown = await fetchLyrics(query());
      expect(unknown?.lyrics).toBe('[00:00.00] First');

      const known = await fetchLyrics(query(240000));
      expect(known?.lyrics).toBe('[00:00.00] Correct edit');
    });

    it('does not cache empty results', async () => {
      await fetchLyrics(query(180000));
      await fetchLyrics(query(180000));
      // Exact lookup, artist search and title-only search, twice.
      expect(mockFetch).toHaveBeenCalledTimes(6);
    });
  });

  describe('pickLyrics', () => {
    it('prefers near-match timings over plain lyrics', () => {
      const result = pickLyrics(
        [
          { plainLyrics: 'plain', duration: 240 },
          { syncedLyrics: '[00:00.00] synced', duration: 185 },
        ],
        180000
      );
      expect(result?.lyrics).toBe('[00:00.00] synced');
      expect(result?.sourceDurationMs).toBe(185000);
    });

    it('keeps a near match so the display can rescale it', () => {
      const result = pickLyrics([{ syncedLyrics: '[00:10.00] line', duration: 200 }], 220000);
      expect(result?.lyrics).toBe('[00:10.00] line');
      expect(result?.sourceDurationMs).toBe(200000);
    });

    it('returns null when nothing is usable', () => {
      expect(pickLyrics([], 180000)).toBeNull();
    });
  });
});
