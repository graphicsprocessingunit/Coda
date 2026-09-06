import { OfflineCacheService } from '../src/services/OfflineCacheService';
import { AppStorageService } from '../src/services/AppStorageService';
import { NavidromeService, NavidromeCredentials } from '../src/services/NavidromeService';

const fs = require('expo-file-system') as any;

const mockCreds: NavidromeCredentials = {
  url: 'http://navidrome.example.com',
  username: 'testuser',
  token: 'abc123',
  salt: 'deadbeef',
};

const CONFIG_ID = NavidromeService.generateConfigId('http://test.com', 'user');

interface TestTrack {
  title: string;
  artist: string;
  uri: string;
  source?: 'local' | 'navidrome';
  navidromeId?: string;
  cachedUri?: string;
}

function makeTrack(id: string, extra: Partial<TestTrack> = {}): TestTrack {
  return {
    title: `Track ${id}`,
    artist: 'Artist',
    uri: `http://navidrome.example.com/rest/stream.view?id=${id}&u=testuser`,
    source: 'navidrome',
    navidromeId: id,
    ...extra,
  };
}

function setupConfig(): void {
  AppStorageService.writeJson('navidrome-settings.json', {
    version: 2,
    activeConfigId: CONFIG_ID,
    configs: [
      { id: CONFIG_ID, name: 'Test', url: 'http://test.com', username: 'user', createdAt: Date.now(), lastUsedAt: Date.now() },
    ],
  });
  AppStorageService.ensureStructure(CONFIG_ID);
  OfflineCacheService.setActiveConfig(CONFIG_ID);
}

let fetchCalls = 0;
let maxConcurrent = 0;
let inFlight = 0;

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function installFetch(options: { failStatusFor?: (id: string) => number | null; delayMs?: number } = {}) {
  fetchCalls = 0;
  maxConcurrent = 0;
  inFlight = 0;
  const delayMs = options.delayMs ?? 10;
  (global as any).fetch = jest.fn(async (url: string) => {
    fetchCalls++;
    const match = url.match(/[?&]id=([^&]+)/);
    const id = match ? decodeURIComponent(match[1]) : '';
    const status = options.failStatusFor ? options.failStatusFor(id) : null;
    if (status !== null) {
      return { ok: false, status, body: null } as Response;
    }
    inFlight++;
    maxConcurrent = Math.max(maxConcurrent, inFlight);
    return new Response(
      new ReadableStream({
        async pull(controller) {
          await sleep(delayMs);
          controller.enqueue(new Uint8Array([65, 66, 67, 68]));
          controller.close();
          inFlight--;
        },
      })
    );
  });
}

describe('OfflineCacheService', () => {
  beforeEach(() => {
    fs.__reset();
    setupConfig();
  });

  describe('isTrackCached', () => {
    it('returns false for non-navidrome tracks without a valid cachedUri', () => {
      expect(OfflineCacheService.isTrackCached(
        { title: 'Local', artist: 'Local', uri: 'file:///music/a.mp3', source: 'local' }
      )).toBe(false);
    });

    it('self-heals to the audio cache file even without cachedUri', () => {
      const audioDir = AppStorageService.getAudioCacheDir(CONFIG_ID);
      audioDir.create({ intermediates: true });
      const file = new (fs.File)(audioDir, 'hydra.mp3');
      file.write('x');
      expect(OfflineCacheService.isTrackCached(makeTrack('hydra'))).toBe(true);
      expect(OfflineCacheService.isTrackCached(makeTrack('ghost'))).toBe(false);
    });

    it('respects cachedUri but falls back when the file is gone', () => {
      const audioDir = AppStorageService.getAudioCacheDir(CONFIG_ID);
      audioDir.create({ intermediates: true });
      const real = new (fs.File)(audioDir, 'real.mp3');
      real.write('x');
      expect(OfflineCacheService.isTrackCached(makeTrack('x', { cachedUri: real.uri }))).toBe(true);
      real.delete();
      expect(OfflineCacheService.isTrackCached(makeTrack('x', { cachedUri: real.uri })))
        .toBe(false);
    });
  });

  describe('downloadTracks', () => {
    it('downloads all tracks with bounded concurrency', async () => {
      installFetch();
      const tracks = [1, 2, 3, 4, 5].map((i) => makeTrack(`id${i}`));
      const result = await OfflineCacheService.downloadTracks(mockCreds, tracks, { concurrency: 3 });

      expect(result.succeeded).toHaveLength(5);
      expect(result.failed).toHaveLength(0);
      expect(result.skipped).toHaveLength(0);
      expect(fetchCalls).toBe(5);
      expect(maxConcurrent).toBeLessThanOrEqual(3);

      const audioDir = AppStorageService.getAudioCacheDir(CONFIG_ID);
      for (const id of ['id1', 'id2', 'id3', 'id4', 'id5']) {
        expect(new (fs.File)(audioDir, `${id}.mp3`).exists).toBe(true);
      }
    });

    it('skips already-cached tracks and dedupes by navidromeId', async () => {
      const audioDir = AppStorageService.getAudioCacheDir(CONFIG_ID);
      audioDir.create({ intermediates: true });
      new (fs.File)(audioDir, 'cached1.mp3').write('x');
      new (fs.File)(audioDir, 'cached2.mp3').write('x');

      installFetch();
      const tracks = ['cached1', 'cached2', 'fresh', 'fresh'].map((id) => makeTrack(id));
      const result = await OfflineCacheService.downloadTracks(mockCreds, tracks, { concurrency: 3 });

      expect(result.skipped.map((t) => t.navidromeId)).toEqual(['cached1', 'cached2']);
      expect(result.succeeded.map((t) => t.navidromeId)).toEqual(['fresh']);
      expect(result.failed).toHaveLength(0);
      expect(fetchCalls).toBe(1);
    });

    it('continues after a per-track failure and reports it', async () => {
      installFetch({ failStatusFor: (id) => (id === 'bad1' ? 404 : null) });
      const tracks = [makeTrack('good1'), makeTrack('bad1'), makeTrack('good2')];
      const result = await OfflineCacheService.downloadTracks(mockCreds, tracks, { concurrency: 3 });

      expect(result.succeeded.map((t) => t.navidromeId)).toEqual(['good1', 'good2']);
      expect(result.failed).toHaveLength(1);
      expect(result.failed[0].track.navidromeId).toBe('bad1');
      expect(result.failed[0].error).toMatch(/not found/i);
      expect(fetchCalls).toBe(3);

      const audioDir = AppStorageService.getAudioCacheDir(CONFIG_ID);
      expect(new (fs.File)(audioDir, 'good2.mp3').exists).toBe(true);
    });

    it('stops dispatching once the batch is aborted', async () => {
      installFetch({ delayMs: 5 });
      const controller = new AbortController();
      const tracks = Array.from({ length: 10 }, (_, i) => makeTrack(`t${i + 1}`));
      let cancelled = false;
      const result = await OfflineCacheService.downloadTracks(mockCreds, tracks, {
        concurrency: 3,
        signal: controller.signal,
        onTrackComplete: () => {
          if (!cancelled) {
            cancelled = true;
            controller.abort();
          }
        },
      });

      expect(cancelled).toBe(true);
      expect(fetchCalls).toBeLessThan(10);
      expect(result.succeeded.length + result.failed.length).toBeLessThan(10);

      const audioDir = AppStorageService.getAudioCacheDir(CONFIG_ID);
      expect(new (fs.File)(audioDir, 't10.mp3').exists).toBe(false);
    });

    it('ignores non-navidrome tracks', async () => {
      installFetch();
      const result = await OfflineCacheService.downloadTracks(mockCreds, [
        { title: 'Local', artist: 'Local', uri: 'file:///music/local.mp3', source: 'local' },
      ]);
      expect(result.succeeded).toHaveLength(0);
      expect(result.failed).toHaveLength(0);
      expect(result.skipped).toHaveLength(0);
      expect(fetchCalls).toBe(0);
    });
  });
});