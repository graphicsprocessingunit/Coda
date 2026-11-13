import AsyncStorage from '@react-native-async-storage/async-storage';
import { File } from 'expo-file-system';

import { fetchLyrics, pickLyrics } from '../src/services/LyricsService';
import { NavidromeService } from '../src/services/NavidromeService';

interface FakeRecord {
  syncedLyrics?: string;
  plainLyrics?: string;
  duration?: number;
}

let exactMatch: FakeRecord | null = null;
let searchResponses: FakeRecord[][] = [];
let fetchCalls: string[] = [];

const defaultFetch = async (url: string) => {
  fetchCalls.push(url);
  if (url.includes('/api/get')) {
    return exactMatch
      ? { ok: true, json: async () => exactMatch }
      : { ok: false, json: async () => ({}) };
  }
  return { ok: true, json: async () => searchResponses.shift() ?? [] };
};

const mockFetch = jest.fn(defaultFetch);

global.fetch = mockFetch as any;

const query = (durationMs?: number) => ({
  artist: 'Artist',
  title: 'Song',
  album: 'Album',
  durationMs,
});

afterEach(() => {
  jest.restoreAllMocks();
});

beforeEach(async () => {
  await AsyncStorage.clear();
  (require('expo-file-system') as { __reset?: () => void }).__reset?.();
  delete process.env.EXPO_PUBLIC_MUSIXMATCH_API_KEY;
  exactMatch = null;
  searchResponses = [];
  fetchCalls = [];
  mockFetch.mockReset();
  mockFetch.mockImplementation(defaultFetch);
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
    });

    it('falls back to plain lyrics when no synced lyrics exist', async () => {
      searchResponses = [[{ plainLyrics: 'No sync available', duration: 180 }]];

      const result = await fetchLyrics(query(180000));
      expect(result?.lyrics).toBe('No sync available');
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

    it('caches a miss so the same track is not refetched on every play', async () => {
      await expect(fetchLyrics(query(180000))).resolves.toBeNull();
      await expect(fetchLyrics(query(180000))).resolves.toBeNull();
      // Exact lookup, artist search and title-only search, once.
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it('retries after the negative cache expires', async () => {
      await fetchLyrics(query(180000));
      await AsyncStorage.setItem(
        '@coda_lyrics_v3_artist::song::180',
        JSON.stringify({ none: true, at: Date.now() - 2 * 60 * 60 * 1000 })
      );

      await fetchLyrics(query(180000));
      expect(mockFetch).toHaveBeenCalledTimes(6);
    });

    it('does not cache a miss caused by a network failure', async () => {
      mockFetch.mockImplementationOnce(async () => {
        throw new Error('offline');
      });

      await expect(fetchLyrics(query(180000))).resolves.toBeNull();
      await expect(fetchLyrics(query(180000))).resolves.toBeNull();
      // One failed request, then a full lookup that found nothing.
      expect(mockFetch).toHaveBeenCalledTimes(4);
    });

    it('uses word-timed richsync before LRCLIB when the provider is configured', async () => {
      process.env.EXPO_PUBLIC_MUSIXMATCH_API_KEY = 'test-key';
      const richBody = JSON.stringify([{ ts: 1, l: [{ c: 'word', o: 0 }] }]);
      mockFetch.mockImplementation(async (url: string) => {
        if (url.includes('matcher.track.get')) {
          return {
            ok: true,
            json: async () => ({
              message: {
                header: { status_code: 200 },
                body: { track: { track_id: 7, track_length: 180, has_richsync: 1 } },
              },
            }),
          };
        }
        if (url.includes('track.richsync.get')) {
          return {
            ok: true,
            json: async () => ({
              message: {
                header: { status_code: 200 },
                body: { richsync: { richsync_body: richBody } },
              },
            }),
          };
        }
        return { ok: false, json: async () => ({}) };
      });

      const result = await fetchLyrics(query(180000));

      expect(result?.lyrics).toContain('<00:01.000>word');
      expect(fetchCalls.some((url) => url.includes('lrclib.net'))).toBe(false);
    });

    it('uses synced lyrics stored on the Navidrome server before going online', async () => {
      jest.spyOn(NavidromeService, 'getLyricsBySongId').mockResolvedValue({
        lyrics: '[00:01.000]server line',
        synced: true,
      });

      const result = await fetchLyrics({ ...query(180000), navidromeSongId: 'song-1' });

      expect(result?.lyrics).toBe('[00:01.000]server line');
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('falls back to plain server lyrics when LRCLIB has no match', async () => {
      jest.spyOn(NavidromeService, 'getLyricsBySongId').mockResolvedValue({
        lyrics: 'plain from server',
        synced: false,
      });

      const result = await fetchLyrics({ ...query(180000), navidromeSongId: 'song-1' });

      expect(result?.lyrics).toBe('plain from server');
      expect(mockFetch).toHaveBeenCalled();
    });

    it('falls back to an .lrc sidecar when LRCLIB has no match', async () => {
      new File('file:///mock-documents/song.lrc').write('[00:01.00] Sidecar line\n[00:03.00] Second');

      const result = await fetchLyrics({
        ...query(180000),
        localUri: 'file:///mock-documents/song.mp3',
      });

      expect(result?.lyrics).toContain('[00:01.00] Sidecar line');
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
    });

    it('rejects timings from a recording outside the duration window', () => {
      expect(pickLyrics([{ syncedLyrics: '[00:10.00] line', duration: 200 }], 230000)).toBeNull();
    });

    it('returns null when nothing is usable', () => {
      expect(pickLyrics([], 180000)).toBeNull();
    });
  });
});
