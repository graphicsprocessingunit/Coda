import * as SecureStore from 'expo-secure-store';
import { NavidromeService, NavidromeCredentials } from '../src/services/NavidromeService';
import { AppStorageService } from '../src/services/AppStorageService';

const fs = require('expo-file-system') as any;

const mockCreds: NavidromeCredentials = {
  url: 'http://navidrome.example.com',
  username: 'testuser',
  token: 'abc123',
  salt: 'deadbeef',
};

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

  describe('credential persistence', () => {
    beforeEach(() => {
      fs.__reset();
    });

    it('saves and loads credentials via SecureStore', async () => {
      const creds: NavidromeCredentials = {
        url: 'http://test.com',
        username: 'user',
        token: 'tok',
        salt: 'sa',
      };
      await NavidromeService.saveCredentials(creds);
      const loaded = await NavidromeService.loadCredentials();
      expect(loaded).toEqual(creds);
    });

    it('saves an encrypted password to settings JSON', async () => {
      const creds: NavidromeCredentials = {
        url: 'http://test.com',
        username: 'user',
        token: 'tok',
        salt: 'sa',
      };
      await NavidromeService.saveCredentials(creds, 'hunter2');
      const settings = AppStorageService.readJson<any>('navidrome-settings.json');
      expect(settings).toEqual({
        url: 'http://test.com',
        username: 'user',
        password: expect.stringMatching(/^v1:/),
      });
      expect(settings.password).not.toContain('hunter2');
    });

    it('loads credentials from encrypted settings JSON', async () => {
      const creds: NavidromeCredentials = {
        url: 'http://test.com',
        username: 'user',
        token: 'tok',
        salt: 'sa',
      };
      await NavidromeService.saveCredentials(creds, 'hunter2');
      const loaded = await NavidromeService.loadCredentials();
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
      await NavidromeService.saveCredentials(creds, 'hunter2');
      const login = await NavidromeService.loadSavedLogin();
      expect(login).toEqual({ url: 'http://test.com', username: 'user', password: 'hunter2' });
    });

    it('falls back to SecureStore when no settings exist', async () => {
      const legacy: NavidromeCredentials = {
        url: 'http://legacy.com',
        username: 'olduser',
        token: 'oldtok',
        salt: 'oldsalt',
      };
      await SecureStore.setItemAsync('@coda_navidrome_credentials', JSON.stringify(legacy));
      const loaded = await NavidromeService.loadCredentials();
      expect(loaded).toEqual(legacy);
    });

    it('clears credentials (SecureStore + settings JSON)', async () => {
      await NavidromeService.saveCredentials(mockCreds, 'hunter2');
      await NavidromeService.clearCredentials();
      const loaded = await NavidromeService.loadCredentials();
      expect(loaded).toBeNull();
      expect(AppStorageService.readJson('navidrome-settings.json')).toBeNull();
    });
  });
});
