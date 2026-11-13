import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

import { AppStorageService } from '../src/services/AppStorageService';
import { migrateToMultiServer } from '../src/services/MigrationService';
import { NavidromeService } from '../src/services/NavidromeService';
import { OfflineCacheService } from '../src/services/OfflineCacheService';

jest.mock('../src/services/AppStorageService', () => ({
  AppStorageService: { readJson: jest.fn(), writeJson: jest.fn() },
}));
jest.mock('../src/services/NavidromeService', () => ({
  NavidromeService: { generateConfigId: jest.fn(), secureStoreKey: jest.fn() },
}));
jest.mock('../src/services/OfflineCacheService', () => ({
  OfflineCacheService: { migrateDownloads: jest.fn() },
}));

const readJson = AppStorageService.readJson as jest.Mock;
const writeJson = AppStorageService.writeJson as jest.Mock;
const generateConfigId = NavidromeService.generateConfigId as jest.Mock;
const secureStoreKey = NavidromeService.secureStoreKey as jest.Mock;
const migrateDownloads = OfflineCacheService.migrateDownloads as jest.Mock;

const SETTINGS = 'navidrome-settings.json';
const LEGACY_KEY = 'coda_navidrome_credentials';
const legacyCreds = JSON.stringify({
  url: 'https://music.example.com',
  username: 'alice',
  password: 'secret',
});

let settings: Map<string, any>;
let secure: Map<string, string>;

function writtenSettings(): any {
  return settings.get(SETTINGS);
}

beforeEach(() => {
  jest.clearAllMocks();
  settings = new Map();
  secure = new Map();
  (AsyncStorage as any).__reset();

  readJson.mockImplementation((name: string) => settings.get(name) ?? null);
  writeJson.mockImplementation((name: string, value: unknown) => {
    settings.set(name, value);
  });
  generateConfigId.mockReturnValue('cfg-1');
  secureStoreKey.mockImplementation((id: string) => `coda_navidrome_${id}`);
  migrateDownloads.mockResolvedValue(undefined);

  (SecureStore.setItemAsync as jest.Mock).mockImplementation(async (key, value) => {
    secure.set(key, value);
  });
  (SecureStore.getItemAsync as jest.Mock).mockImplementation(async (key) => secure.get(key) ?? null);
  (SecureStore.deleteItemAsync as jest.Mock).mockImplementation(async (key) => {
    secure.delete(key);
  });
});

describe('migrateToMultiServer', () => {
  it('leaves an existing v2 settings file alone', async () => {
    settings.set(SETTINGS, { version: 2, activeConfigId: 'cfg-1', configs: [{ id: 'cfg-1' }] });

    await expect(migrateToMultiServer()).resolves.toBeNull();

    expect(writeJson).not.toHaveBeenCalled();
    expect(migrateDownloads).not.toHaveBeenCalled();
  });

  it('writes an empty v2 file when there is nothing to migrate', async () => {
    await expect(migrateToMultiServer()).resolves.toBeNull();

    expect(writtenSettings()).toEqual({ version: 2, activeConfigId: '', configs: [] });
    expect(migrateDownloads).not.toHaveBeenCalled();
  });

  it('migrates plaintext single-server settings', async () => {
    settings.set(SETTINGS, {
      url: 'https://music.example.com',
      username: 'alice',
      password: 'secret',
    });
    secure.set(LEGACY_KEY, legacyCreds);

    await expect(migrateToMultiServer()).resolves.toBe('cfg-1');

    expect(generateConfigId).toHaveBeenCalledWith('https://music.example.com', 'alice');
    const result = writtenSettings();
    expect(result.version).toBe(2);
    expect(result.activeConfigId).toBe('cfg-1');
    expect(result.configs).toHaveLength(1);
    expect(result.configs[0]).toMatchObject({
      id: 'cfg-1',
      name: 'My Server',
      url: 'https://music.example.com',
      username: 'alice',
    });
  });

  it('moves credentials to the config-scoped SecureStore key', async () => {
    settings.set(SETTINGS, { url: 'https://music.example.com', username: 'alice' });
    secure.set(LEGACY_KEY, legacyCreds);

    await migrateToMultiServer();

    expect(secure.get('coda_navidrome_cfg-1')).toBe(legacyCreds);
    expect(secure.has(LEGACY_KEY)).toBe(false);
  });

  it('uses credentials that only exist in SecureStore', async () => {
    secure.set(LEGACY_KEY, JSON.stringify({ url: 'https://old.example.com', username: 'bob' }));

    await expect(migrateToMultiServer()).resolves.toBe('cfg-1');
    expect(generateConfigId).toHaveBeenCalledWith('https://old.example.com', 'bob');
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith('@coda_navidrome_credentials');
  });

  it('ignores malformed legacy credentials', async () => {
    secure.set(LEGACY_KEY, '{not json');

    await expect(migrateToMultiServer()).resolves.toBeNull();
    expect(writtenSettings()).toEqual({ version: 2, activeConfigId: '', configs: [] });
  });

  it('scopes the legacy AsyncStorage keys and keeps existing scoped values', async () => {
    settings.set(SETTINGS, { url: 'https://music.example.com', username: 'alice' });
    await AsyncStorage.setItem('@coda_library', '["legacy"]');
    await AsyncStorage.setItem('@coda_playlists', '["legacy-playlist"]');
    await AsyncStorage.setItem('@coda_library_cfg-1', '["already scoped"]');

    await migrateToMultiServer();

    expect(await AsyncStorage.getItem('@coda_library_cfg-1')).toBe('["already scoped"]');
    expect(await AsyncStorage.getItem('@coda_playlists_cfg-1')).toBe('["legacy-playlist"]');
    // The unscoped keys are left in place; only the scoped copies are written.
    expect(await AsyncStorage.getItem('@coda_library')).toBe('["legacy"]');
  });

  it('moves the download folder to the new config id', async () => {
    settings.set(SETTINGS, { url: 'https://music.example.com', username: 'alice' });

    await migrateToMultiServer();

    expect(migrateDownloads).toHaveBeenCalledWith('cfg-1');
  });

  it('is idempotent: a second run does nothing', async () => {
    settings.set(SETTINGS, { url: 'https://music.example.com', username: 'alice' });

    await expect(migrateToMultiServer()).resolves.toBe('cfg-1');
    const writes = writeJson.mock.calls.length;

    await expect(migrateToMultiServer()).resolves.toBeNull();
    expect(writeJson).toHaveBeenCalledTimes(writes);
    expect(migrateDownloads).toHaveBeenCalledTimes(1);
  });

  it('returns null instead of throwing when reading settings fails', async () => {
    const error = jest.spyOn(console, 'error').mockImplementation(() => {});
    readJson.mockImplementation(() => {
      throw new Error('disk unavailable');
    });

    await expect(migrateToMultiServer()).resolves.toBeNull();
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });

  it('keeps the migrated config when the download migration fails', async () => {
    const error = jest.spyOn(console, 'error').mockImplementation(() => {});
    settings.set(SETTINGS, { url: 'https://music.example.com', username: 'alice' });
    migrateDownloads.mockRejectedValue(new Error('cache busy'));

    await expect(migrateToMultiServer()).resolves.toBeNull();
    expect(writtenSettings().activeConfigId).toBe('cfg-1');
    error.mockRestore();
  });

  it('finishes the settings migration when copying SecureStore credentials fails', async () => {
    const error = jest.spyOn(console, 'error').mockImplementation(() => {});
    settings.set(SETTINGS, { url: 'https://music.example.com', username: 'alice' });
    secure.set(LEGACY_KEY, legacyCreds);
    (SecureStore.setItemAsync as jest.Mock).mockRejectedValueOnce(new Error('keychain locked'));

    await expect(migrateToMultiServer()).resolves.toBe('cfg-1');
    expect(writtenSettings().configs).toHaveLength(1);
    expect(migrateDownloads).toHaveBeenCalledWith('cfg-1');
    error.mockRestore();
  });
});
