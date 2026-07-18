import AsyncStorage from '@react-native-async-storage/async-storage';

const mockFetch = jest.fn();
global.fetch = mockFetch as any;

import { fetchLyrics } from '../src/services/LyricsService';

beforeEach(async () => {
  await AsyncStorage.clear();
  mockFetch.mockReset();
});

describe('LyricsService', () => {
  describe('fetchLyrics', () => {
    it('returns cached lyrics on second call', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [
          { syncedLyrics: '[00:10.00] Hello', duration: 180 },
        ],
      });

      const first = await fetchLyrics('Artist', 'Song', 'Album', 180000);
      expect(first).toBe('[00:10.00] Hello');

      const second = await fetchLyrics('Artist', 'Song', 'Album', 180000);
      expect(second).toBe('[00:10.00] Hello');
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('returns synced lyrics when available', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [
          { syncedLyrics: '[00:01.00] Line 1\n[00:02.00] Line 2', duration: 200 },
          { plainLyrics: 'Plain text', duration: 175 },
        ],
      });

      const result = await fetchLyrics('Artist', 'Song', 'Album', 200000);
      expect(result).toContain('[00:01.00] Line 1');
    });

    it('falls back to plain lyrics when no synced lyrics', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [
          { plainLyrics: 'No sync available', duration: 180 },
        ],
      });

      const result = await fetchLyrics('Artist', 'Song', 'Album', 180000);
      expect(result).toBe('No sync available');
    });

    it('returns null when no results found', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      });

      const result = await fetchLyrics('Artist', 'Song', 'Album', 180000);
      expect(result).toBeNull();
    });

    it('returns null on fetch error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await fetchLyrics('Artist', 'Song', 'Album', 180000);
      expect(result).toBeNull();
    });

    it('skips artist search when artist is Unknown Artist', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [
          { syncedLyrics: '[00:00.00] Hi', duration: 120 },
        ],
      });

      const result = await fetchLyrics('Unknown Artist', 'Song', 'Album', 120000);
      expect(result).toBe('[00:00.00] Hi');
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch.mock.calls[0][0]).not.toContain('artist_name');
    });

    it('selects closest duration match', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [
          { syncedLyrics: '[00:00.00] Far', duration: 300 },
          { syncedLyrics: '[00:00.00] Close', duration: 182 },
          { syncedLyrics: '[00:00.00] Medium', duration: 200 },
        ],
      });

      const result = await fetchLyrics('Artist', 'Song', 'Album', 180000);
      expect(result).toBe('[00:00.00] Close');
    });
  });
});
