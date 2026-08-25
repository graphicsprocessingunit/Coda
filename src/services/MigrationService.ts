import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { NavidromeService } from './NavidromeService';
import { AppStorageService } from './AppStorageService';
import { StorageService } from './StorageService';
import { OfflineCacheService } from './OfflineCacheService';
import { TrackMetadata, Playlist, SmartPlaylist } from '../context/AudioContext';

const SETTINGS_FILE = 'navidrome-settings.json';
const LEGACY_SECURE_KEY = 'coda_navidrome_credentials';

interface OldSettings {
  url?: string;
  username?: string;
  password?: string;
  token?: string;
  salt?: string;
}

export async function migrateToMultiServer(): Promise<string | null> {
  try {
    const raw = AppStorageService.readJson<any>(SETTINGS_FILE);
    if (raw && raw.version === 2 && Array.isArray(raw.configs)) {
      return null;
    }

    console.log('[Migration] Migrating from single-server format to multi-server');

    let oldSettings: OldSettings | null = null;

    if (raw && raw.url && raw.username) {
      oldSettings = raw as OldSettings;
    }

    if (!oldSettings) {
      const legacyCreds = await SecureStore.getItemAsync(LEGACY_SECURE_KEY);
      if (legacyCreds) {
        try {
          const parsed = JSON.parse(legacyCreds);
          if (parsed.url && parsed.username) {
            oldSettings = { url: parsed.url, username: parsed.username };
          }
        } catch {}
      }
    }

    if (!oldSettings || !oldSettings.url || !oldSettings.username) {
      console.log('[Migration] No old settings found, writing empty v2 config');
      AppStorageService.writeJson(SETTINGS_FILE, {
        version: 2,
        activeConfigId: '',
        configs: [],
      });
      return null;
    }

    const configId = NavidromeService.generateConfigId(oldSettings.url, oldSettings.username);
    const now = Date.now();
    const config = {
      id: configId,
      name: 'My Server',
      url: oldSettings.url,
      username: oldSettings.username,
      createdAt: now,
      lastUsedAt: now,
    };

    AppStorageService.writeJson(SETTINGS_FILE, {
      version: 2,
      activeConfigId: configId,
      configs: [config],
    });
    console.log(`[Migration] Created config ${configId} ("${config.name}")`);

    try {
      const existingCreds = await SecureStore.getItemAsync(LEGACY_SECURE_KEY);
      if (existingCreds) {
        await SecureStore.setItemAsync(NavidromeService.secureStoreKey(configId), existingCreds);
        await SecureStore.deleteItemAsync(LEGACY_SECURE_KEY);
        console.log('[Migration] Moved credentials to config-scoped SecureStore key');
      }
    } catch (error) {
      console.error('[Migration] Error moving SecureStore credentials:', error);
    }

    try {
      await AsyncStorage.removeItem('@coda_navidrome_credentials');
    } catch {}

    await migrateStorageKeys(configId);
    await OfflineCacheService.migrateDownloads(configId);

    console.log('[Migration] Multi-server migration complete');
    return configId;
  } catch (error) {
    console.error('[Migration] Migration failed:', error);
    return null;
  }
}

async function migrateStorageKeys(configId: string): Promise<void> {
  const pairs: [string, string][] = [
    ['@coda_library', `@coda_library_${configId}`],
    ['@coda_playlists', `@coda_playlists_${configId}`],
    ['@coda_current_track', `@coda_current_track_${configId}`],
    ['@coda_playback_position', `@coda_playback_position_${configId}`],
    ['@coda_queue', `@coda_queue_${configId}`],
    ['@coda_smart_playlists', `@coda_smart_playlists_${configId}`],
  ];

  for (const [oldKey, newKey] of pairs) {
    try {
      const existing = await AsyncStorage.getItem(newKey);
      if (existing) continue;
      const value = await AsyncStorage.getItem(oldKey);
      if (value) {
        await AsyncStorage.setItem(newKey, value);
        console.log(`[Migration] Scoped ${oldKey} → ${newKey}`);
      }
    } catch (error) {
      console.error(`[Migration] Error migrating ${oldKey}:`, error);
    }
  }
}
