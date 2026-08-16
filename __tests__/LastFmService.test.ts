import * as SecureStore from 'expo-secure-store';
import { LastFmService, LastFmCredentials } from '../src/services/LastFmService';
import { AppStorageService } from '../src/services/AppStorageService';

const fs = require('expo-file-system') as any;

const mockCreds: LastFmCredentials = {
  apiKey: 'api-key-123',
  sharedSecret: 'shared-secret-456',
  sessionKey: 'session-key-789',
  username: 'scrobble-user',
};

describe('LastFmService credential persistence', () => {
  beforeEach(() => {
    fs.__reset();
  });

  it('persists credentials with encrypted secrets in settings JSON', async () => {
    await LastFmService.saveCredentials(mockCreds);
    const settings = AppStorageService.readJson<any>('lastfm-settings.json');
    expect(settings?.username).toBe('scrobble-user');
    expect(settings?.apiKey).toMatch(/^v1:/);
    expect(settings?.sharedSecret).toMatch(/^v1:/);
    expect(settings?.sessionKey).toMatch(/^v1:/);
    expect(settings.apiKey).not.toContain('api-key-123');
    expect(settings.sharedSecret).not.toContain('shared-secret-456');
    expect(settings.sessionKey).not.toContain('session-key-789');
  });

  it('loads credentials from the encrypted settings JSON', async () => {
    await LastFmService.saveCredentials(mockCreds);
    const loaded = await LastFmService.loadCredentials();
    expect(loaded).toEqual(mockCreds);
  });

  it('loadSavedLogin returns decrypted apiKey/sharedSecret', async () => {
    await LastFmService.saveCredentials(mockCreds);
    const login = await LastFmService.loadSavedLogin();
    expect(login).toEqual({
      apiKey: 'api-key-123',
      sharedSecret: 'shared-secret-456',
      username: 'scrobble-user',
    });
  });

  it('falls back to SecureStore when no settings JSON exists', async () => {
    await SecureStore.setItemAsync('@coda_lastfm_credentials', JSON.stringify(mockCreds));
    const loaded = await LastFmService.loadCredentials();
    expect(loaded).toEqual(mockCreds);
  });

  it('clears credentials (JSON + SecureStore)', async () => {
    await LastFmService.saveCredentials(mockCreds);
    await LastFmService.clearCredentials();
    expect(await LastFmService.loadCredentials()).toBeNull();
    expect(AppStorageService.readJson('lastfm-settings.json')).toBeNull();
  });
});
