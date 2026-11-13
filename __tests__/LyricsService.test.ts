import AsyncStorage from '@react-native-async-storage/async-storage';

import { fetchLyrics, pickLyrics } from '../src/services/LyricsService';

const mockFetch = jest.fn();
global.fetch = mockFetch as any;

const respond = (records: unknown[]) => ({
  ok: true,
  json: async () => records,
});

const query = (durationMs?: number) => ({
  artist: 'Artist',
  title: 'Song',
  album: 'Album',
  durationMs,
});

beforeEach(async () => {
  await AsyncStorage.clear();
  mockFetch.mockReset();
});

describe('LyricsService', () => {
  describe('fetchLyrics', () => {
    it('returns cached lyrics on second call', async () => {
      mockFetch.mockResolvedValueOnce(
        respond([{ syncedLyrics: '[00:10.00] Hello', duration: 180 }])
      );

      const first = await fetchLyrics(query(180000));
      expect(first?.lyrics).toBe('[00:10.00] Hello');

      const second = await fetchLyrics(query(180000));
      expect(second?.lyrics).toBe('[00:10.00] Hello');
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('returns synced lyrics when available', async () => {
      mockFetch.mockResolvedValueOnce(
        respond([
          { syncedLyrics: '[00:01.00] Line 1\n[00:02.00] Line 2', duration: 200 },
          { plainLyrics: 'Plain text', duration: 175 },
        ])
      );

      const result = await fetchLyrics(query(200000));
      expect(result?.lyrics).toContain('[00:01.00] Line 1');
      expect(result?.sourceDurationMs).toBe(200000);
    });

    it('falls back to plain lyrics when no synced lyrics exist', async () => {
      mockFetch.mockResolvedValueOnce(respond([{ plainLyrics: 'No sync available', duration: 180 }]));

      const result = await fetchLyrics(query(180000));
      expect(result?.lyrics).toBe('No sync available');
      expect(result?.sourceDurationMs).toBeUndefined();
    });

    it('returns null when no results are found', async () => {
      mockFetch.mockResolvedValueOnce(respond([]));

      await expect(fetchLyrics(query(180000))).resolves.toBeNull();
    });

    it('returns null on fetch error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      await expect(fetchLyrics(query(180000))).resolves.toBeNull();
    });

    it('skips the artist search when the artist is unknown', async () => {
      mockFetch.mockResolvedValueOnce(respond([{ syncedLyrics: '[00:00.00] Hi', duration: 120 }]));

      const result = await fetchLyrics({ ...query(120000), artist: 'Unknown Artist' });
      expect(result?.lyrics).toBe('[00:00.00] Hi');
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch.mock.calls[0][0]).not.toContain('artist_name');
    });

    it('selects the closest same-length version', async () => {
      mockFetch.mockResolvedValueOnce(
        respond([
          { syncedLyrics: '[00:00.00] Far', duration: 300 },
          { syncedLyrics: '[00:00.00] Close', duration: 182 },
          { syncedLyrics: '[00:00.00] Medium', duration: 200 },
        ])
      );

      const result = await fetchLyrics(query(180000));
      expect(result?.lyrics).toBe('[00:00.00] Close');
    });

    it('rejects timings from a clearly different recording', async () => {
      mockFetch
        .mockResolvedValueOnce(respond([{ syncedLyrics: '[00:00.00] Live version', duration: 120 }]))
        .mockResolvedValueOnce(respond([{ syncedLyrics: '[00:00.00] Live version', duration: 120 }]));

      await expect(fetchLyrics(query(270000))).resolves.toBeNull();
    });

    it('refetches when a duration becomes known instead of reusing the unknown-duration match', async () => {
      mockFetch
        .mockResolvedValueOnce(respond([{ syncedLyrics: '[00:00.00] First', duration: 100 }]))
        .mockResolvedValueOnce(respond([{ syncedLyrics: '[00:00.00] Correct edit', duration: 240 }]));

      const unknown = await fetchLyrics(query());
      expect(unknown?.lyrics).toBe('[00:00.00] First');

      const known = await fetchLyrics(query(240000));
      expect(known?.lyrics).toBe('[00:00.00] Correct edit');
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('does not cache empty results', async () => {
      mockFetch
        .mockResolvedValueOnce(respond([]))
        .mockResolvedValueOnce(respond([]))
        .mockResolvedValueOnce(respond([]))
        .mockResolvedValueOnce(respond([]));

      await fetchLyrics(query(180000));
      await fetchLyrics(query(180000));
      // Artist search plus title-only fallback, twice.
      expect(mockFetch).toHaveBeenCalledTimes(4);
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
