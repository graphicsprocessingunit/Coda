import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NavidromeService, NavidromeCredentials } from '../src/services/NavidromeService';
import { AppStorageService } from '../src/services/AppStorageService';

const fs = require('expo-file-system') as any;

const mockCreds: NavidromeCredentials = {
  url: 'http://navidrome.example.com',
  username: 'testuser',
  token: 'abc123',
  salt: 'deadbeef',
};

const TEST_CONFIG_ID = NavidromeService.generateConfigId('http://test.com', 'user');

function setupTestConfig() {
  AppStorageService.writeJson('navidrome-settings.json', {
    version: 2,
    activeConfigId: TEST_CONFIG_ID,
    configs: [{ id: TEST_CONFIG_ID, name: 'Test', url: 'http://test.com', username: 'user', createdAt: Date.now(), lastUsedAt: Date.now() }],
  });
}

describe('NavidromeService', () => {
  describe('createToken', () => {
    it('returns a 32-char hex string', () => {
      const token = NavidromeService.createToken('password123', 'salt456');
      expect(typeof token).toBe('string');
      expect(token.length).toBe(32);
      expect(token).toMatch(/^[0-9a-f]{32}$/);
    });

    it('is deterministic', () => {
      const t1 = NavidromeService.createToken('pass', 'salt');
      const t2 = NavidromeService.createToken('pass', 'salt');
      expect(t1).toBe(t2);
    });

    it('produces different tokens for different inputs', () => {
      const t1 = NavidromeService.createToken('pass1', 'salt');
      const t2 = NavidromeService.createToken('pass2', 'salt');
      expect(t1).not.toBe(t2);
    });
  });

  describe('buildUrl', () => {
    it('constructs a valid Subsonic API URL', () => {
      const url = NavidromeService.buildUrl(mockCreds, 'ping');
      expect(url).toContain('http://navidrome.example.com/rest/ping.view?');
      expect(url).toContain('u=testuser');
      expect(url).toContain('t=abc123');
      expect(url).toContain('s=deadbeef');
      expect(url).toContain('v=1.16.1');
      expect(url).toContain('c=Coda');
      expect(url).toContain('f=json');
    });

    it('strips trailing slashes from URL', () => {
      const creds = { ...mockCreds, url: 'http://example.com///' };
      const url = NavidromeService.buildUrl(creds, 'ping');
      expect(url).toMatch(/^http:\/\/example\.com\/rest/);
    });

    it('appends custom params', () => {
      const url = NavidromeService.buildUrl(mockCreds, 'stream', { id: 'track123' });
      expect(url).toContain('id=track123');
    });
  });

  describe('getStreamUrl', () => {
    it('builds stream URL with song id', () => {
      const url = NavidromeService.getStreamUrl(mockCreds, 'song42');
      expect(url).toContain('rest/stream.view');
      expect(url).toContain('id=song42');
    });
  });

  describe('getCoverArtUrl', () => {
    it('builds cover art URL with id', () => {
      const url = NavidromeService.getCoverArtUrl(mockCreds, 'art99');
      expect(url).toContain('rest/getCoverArt.view');
      expect(url).toContain('id=art99');
    });

    it('includes size param when specified', () => {
      const url = NavidromeService.getCoverArtUrl(mockCreds, 'art99', 300);
      expect(url).toContain('size=300');
    });

    it('omits size param when not specified', () => {
      const url = NavidromeService.getCoverArtUrl(mockCreds, 'art99');
      expect(url).not.toContain('size=');
    });
  });

  describe('songToTrackMetadata', () => {
    it('converts a NavidromeSong to TrackMetadata', () => {
      const song = {
        id: 's1',
        title: 'Test Song',
        artist: 'Test Artist',
        duration: 180,
        coverArt: 'art1',
      };
      const meta = NavidromeService.songToTrackMetadata(mockCreds, song);
      expect(meta.title).toBe('Test Song');
      expect(meta.artist).toBe('Test Artist');
      expect(meta.duration).toBe(180);
      expect(meta.uri).toContain('stream.view');
      expect(meta.uri).toContain('id=s1');
      expect(meta.artwork).toContain('getCoverArt');
      expect(meta.source).toBe('navidrome');
      expect(meta.navidromeId).toBe('s1');
    });

    it('uses Unknown Artist when artist is missing', () => {
      const song = { id: 's2', title: 'No Artist' };
      const meta = NavidromeService.songToTrackMetadata(mockCreds, song);
      expect(meta.artist).toBe('Unknown Artist');
    });

    it('omits artwork when coverArt is missing', () => {
      const song = { id: 's3', title: 'No Cover' };
      const meta = NavidromeService.songToTrackMetadata(mockCreds, song);
      expect(meta.artwork).toBeUndefined();
    });
  });

  describe('config CRUD', () => {
    beforeEach(() => {
      fs.__reset();
      (SecureStore as any).__reset();
      (AsyncStorage as any).__reset();
    });

    it('generates deterministic config IDs', () => {
      const id1 = NavidromeService.generateConfigId('http://test.com', 'user');
      const id2 = NavidromeService.generateConfigId('http://test.com', 'user');
      expect(id1).toBe(id2);
      expect(id1.length).toBeLessThanOrEqual(16);
      expect(id1.length).toBeGreaterThanOrEqual(1);
    });

    it('generates different IDs for different servers', () => {
      const id1 = NavidromeService.generateConfigId('http://server1.com', 'user1');
      const id2 = NavidromeService.generateConfigId('http://server2.com', 'user2');
      expect(id1).not.toBe(id2);
    });

    it('lists empty configs by default', () => {
      const settings = NavidromeService.listConfigs();
      expect(settings.configs).toEqual([]);
      expect(settings.activeConfigId).toBe('');
    });
  });

  describe('credential persistence', () => {
    beforeEach(() => {
      fs.__reset();
      (SecureStore as any).__reset();
      (AsyncStorage as any).__reset();
      setupTestConfig();
    });

    it('saves and loads credentials via SecureStore', async () => {
      const creds: NavidromeCredentials = {
        url: 'http://test.com',
        username: 'user',
        token: 'tok',
        salt: 'sa',
      };
      await NavidromeService.saveCredentials(TEST_CONFIG_ID, creds);
      const loaded = await NavidromeService.loadCredentials(TEST_CONFIG_ID);
      expect(loaded).toEqual(creds);
    });

    it('saves an encrypted password to config settings JSON', async () => {
      const creds: NavidromeCredentials = {
        url: 'http://test.com',
        username: 'user',
        token: 'tok',
        salt: 'sa',
      };
      await NavidromeService.saveCredentials(TEST_CONFIG_ID, creds, 'hunter2');
      const settings = NavidromeService.loadSettingsForConfig(TEST_CONFIG_ID);
      expect(settings).toEqual({
        url: 'http://test.com',
        username: 'user',
        password: expect.stringMatching(/^v1:/),
      });
      expect(settings!.password).not.toContain('hunter2');
    });

    it('loads credentials from encrypted config settings JSON', async () => {
      const creds: NavidromeCredentials = {
        url: 'http://test.com',
        username: 'user',
        token: 'tok',
        salt: 'sa',
      };
      await NavidromeService.saveCredentials(TEST_CONFIG_ID, creds, 'hunter2');
      const loaded = await NavidromeService.loadCredentials(TEST_CONFIG_ID);
      expect(loaded?.url).toBe('http://test.com');
      expect(loaded?.username).toBe('user');
      expect(loaded?.token).toMatch(/^[0-9a-f]{32}$/);
    });

    it('loadSavedLogin returns the decrypted password', async () => {
      const creds: NavidromeCredentials = {
        url: 'http://test.com',
        username: 'user',
        token: 'tok',
        salt: 'sa',
      };
      await NavidromeService.saveCredentials(TEST_CONFIG_ID, creds, 'hunter2');
      const login = await NavidromeService.loadSavedLogin(TEST_CONFIG_ID);
      expect(login).toEqual({ url: 'http://test.com', username: 'user', password: 'hunter2' });
    });

    it('falls back to SecureStore when no config settings exist', async () => {
      const legacy: NavidromeCredentials = {
        url: 'http://test.com',
        username: 'user',
        token: 'oldtok',
        salt: 'oldsalt',
      };
      await SecureStore.setItemAsync(NavidromeService.secureStoreKey(TEST_CONFIG_ID), JSON.stringify(legacy));
      const loaded = await NavidromeService.loadCredentials(TEST_CONFIG_ID);
      expect(loaded).toEqual(legacy);
    });

    it('clears credentials (SecureStore + config settings JSON)', async () => {
      const creds: NavidromeCredentials = {
        url: 'http://test.com',
        username: 'user',
        token: 'tok',
        salt: 'sa',
      };
      await NavidromeService.saveCredentials(TEST_CONFIG_ID, creds, 'hunter2');
      await NavidromeService.clearCredentials(TEST_CONFIG_ID);
      const loaded = await NavidromeService.loadCredentials(TEST_CONFIG_ID);
      expect(loaded).toBeNull();
      expect(NavidromeService.loadSettingsForConfig(TEST_CONFIG_ID)).toBeNull();
    });
  });

  describe('server playlists and starred songs', () => {
    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('maps getPlaylists results', async () => {
      const spy = jest.spyOn(NavidromeService, 'apiCall').mockResolvedValue({
        playlists: {
          playlist: [
            { id: 'p1', name: 'Road Trip', songCount: 12, owner: 'user' },
            { id: 'p2', name: 'Focus', songCount: 4 },
          ],
        },
      } as any);

      const playlists = await NavidromeService.getPlaylists(mockCreds);

      expect(spy).toHaveBeenCalledWith(mockCreds, 'getPlaylists');
      expect(playlists).toHaveLength(2);
      expect(playlists[0]).toMatchObject({ id: 'p1', name: 'Road Trip', songCount: 12, owner: 'user' });
      expect(playlists[1]).toMatchObject({ id: 'p2', name: 'Focus' });
    });

    it('handles a single playlist returned as an object', async () => {
      jest.spyOn(NavidromeService, 'apiCall').mockResolvedValue({
        playlists: { playlist: { id: 'only', name: 'Only One', songCount: 2 } },
      } as any);

      const playlists = await NavidromeService.getPlaylists(mockCreds);

      expect(playlists).toHaveLength(1);
      expect(playlists[0].name).toBe('Only One');
    });

    it('returns an empty list when the server fails', async () => {
      jest.spyOn(NavidromeService, 'apiCall').mockRejectedValue(new Error('HTTP 500'));
      await expect(NavidromeService.getPlaylists(mockCreds)).resolves.toEqual([]);
    });

    it('maps getPlaylist entries to songs', async () => {
      const spy = jest.spyOn(NavidromeService, 'apiCall').mockResolvedValue({
        playlist: {
          id: 'p1',
          name: 'Road Trip',
          songCount: 2,
          entry: [
            { id: 's1', title: 'First', artist: 'A', duration: 100 },
            { id: 's2', title: 'Second', artist: 'B' },
          ],
        },
      } as any);

      const { playlist, songs } = await NavidromeService.getPlaylist(mockCreds, 'p1');

      expect(spy).toHaveBeenCalledWith(mockCreds, 'getPlaylist', { id: 'p1' });
      expect(playlist).toMatchObject({ id: 'p1', name: 'Road Trip' });
      expect(songs.map((s) => s.title)).toEqual(['First', 'Second']);
      expect(songs[0].duration).toBe(100);
    });

    it('normalizes a single-entry playlist response', async () => {
      jest.spyOn(NavidromeService, 'apiCall').mockResolvedValue({
        playlist: { id: 'p3', name: 'Solo', entry: { id: 's9', title: 'Only Song' } },
      } as any);

      const { songs } = await NavidromeService.getPlaylist(mockCreds, 'p3');

      expect(songs).toHaveLength(1);
      expect(songs[0].id).toBe('s9');
    });

    it('returns no songs when the playlist is missing', async () => {
      jest.spyOn(NavidromeService, 'apiCall').mockResolvedValue({} as any);
      const result = await NavidromeService.getPlaylist(mockCreds, 'gone');
      expect(result.playlist).toBeNull();
      expect(result.songs).toEqual([]);
    });

    it('maps starred songs from getStarred2', async () => {
      const spy = jest.spyOn(NavidromeService, 'apiCall').mockResolvedValue({
        starred2: { song: [{ id: 'z1', title: 'Loved', artist: 'C', album: 'LP' }] },
      } as any);

      const songs = await NavidromeService.getStarredSongs(mockCreds);

      expect(spy).toHaveBeenCalledWith(mockCreds, 'getStarred2');
      expect(songs).toHaveLength(1);
      expect(songs[0]).toMatchObject({ id: 'z1', title: 'Loved', album: 'LP' });
    });

    it('returns an empty list when nothing is starred', async () => {
      jest.spyOn(NavidromeService, 'apiCall').mockResolvedValue({ starred2: {} } as any);
      await expect(NavidromeService.getStarredSongs(mockCreds)).resolves.toEqual([]);
    });
  });
});
