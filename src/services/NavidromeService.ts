import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import md5 from 'md5';
import { AppStorageService } from './AppStorageService';
import { CryptoService } from './CryptoService';
import { TrackMetadata } from '../context/AudioContext';

const STORAGE_KEYS = {
  CREDENTIALS: 'coda_navidrome_credentials',
  LEGACY_ASYNC_CREDENTIALS: '@coda_navidrome_credentials',
};

const SETTINGS_FILE = 'navidrome-settings.json';

export interface ServerConfig {
  id: string;
  name: string;
  url: string;
  username: string;
  createdAt: number;
  lastUsedAt: number;
}

export interface ServerSettings {
  version: 2;
  activeConfigId: string;
  configs: ServerConfig[];
}

export interface NavidromeCredentials {
  url: string;
  username: string;
  token: string;
  salt: string;
}

export interface NavidromeSettings {
  url: string;
  username: string;
  password?: string;
  token?: string;
  salt?: string;
}

export interface NavidromeArtist {
  id: string;
  name: string;
  albumCount?: number;
  coverArt?: string;
}

export interface NavidromeAlbum {
  id: string;
  name: string;
  artist?: string;
  artistId?: string;
  songCount?: number;
  coverArt?: string;
  year?: number;
}

export interface NavidromeSong {
  id: string;
  title: string;
  artist?: string;
  artistId?: string;
  album?: string;
  albumId?: string;
  duration?: number;
  track?: number;
  coverArt?: string;
}

function generateSalt(): string {
  const chars = 'abcdef0123456789';
  const bytes = Crypto.getRandomBytes(16);
  let salt = '';
  for (let i = 0; i < 16; i++) {
    salt += chars[bytes[i] % chars.length];
  }
  return salt;
}

export class NavidromeService {
  static generateConfigId(url: string, username: string): string {
    const raw = `${url.toLowerCase().replace(/\/+$/, '')}|${username.toLowerCase()}`;
    let hash = 0;
    for (let i = 0; i < raw.length; i++) {
      const char = raw.charCodeAt(i);
      hash = ((hash << 5) - hash + char) | 0;
    }
    const hex = Math.abs(hash).toString(16).padStart(8, '0');
    return hex.slice(0, 16);
  }

  static listConfigs(): ServerSettings {
    const raw = AppStorageService.readJson<any>(SETTINGS_FILE);
    if (raw && raw.version === 2 && Array.isArray(raw.configs)) {
      return raw as ServerSettings;
    }
    return { version: 2, activeConfigId: '', configs: [] };
  }

  static getActiveConfig(): ServerConfig | null {
    const settings = this.listConfigs();
    if (!settings.activeConfigId || settings.configs.length === 0) return null;
    return settings.configs.find((c) => c.id === settings.activeConfigId) || null;
  }

  static getConfigById(id: string): ServerConfig | null {
    const settings = this.listConfigs();
    return settings.configs.find((c) => c.id === id) || null;
  }

  static async addConfig(
    name: string,
    url: string,
    username: string,
    password: string,
  ): Promise<{ config: ServerConfig; creds: NavidromeCredentials }> {
    const result = await this.ping(url, username, password);
    if (!result.ok || !result.creds) {
      throw new Error(result.error || 'Connection failed');
    }
    const configId = this.generateConfigId(url, username);
    const config: ServerConfig = {
      id: configId,
      name: name.trim() || 'My Server',
      url,
      username,
      createdAt: Date.now(),
      lastUsedAt: Date.now(),
    };
    const settings = this.listConfigs();
    settings.configs.push(config);
    settings.activeConfigId = configId;
    AppStorageService.writeJson(SETTINGS_FILE, settings);
    await this.saveCredentials(configId, result.creds, password);
    return { config, creds: result.creds };
  }

  static async updateConfig(id: string, changes: { name?: string; url?: string; username?: string; password?: string }): Promise<void> {
    const settings = this.listConfigs();
    const idx = settings.configs.findIndex((c) => c.id === id);
    if (idx === -1) throw new Error('Config not found');
    const config = settings.configs[idx];
    if (changes.name !== undefined) config.name = changes.name.trim() || config.name;
    if (changes.url !== undefined) config.url = changes.url;
    if (changes.username !== undefined) config.username = changes.username;
    AppStorageService.writeJson(SETTINGS_FILE, settings);
    if (changes.password || changes.url || changes.username) {
      const password = changes.password || '';
      const result = await this.ping(config.url, config.username, password);
      if (!result.ok || !result.creds) {
        throw new Error(result.error || 'Connection failed');
      }
      await this.saveCredentials(id, result.creds, changes.password || undefined);
    }
  }

  static async deleteConfig(id: string): Promise<void> {
    const settings = this.listConfigs();
    settings.configs = settings.configs.filter((c) => c.id !== id);
    if (settings.activeConfigId === id) {
      settings.activeConfigId = settings.configs.length > 0 ? settings.configs[0].id : '';
    }
    AppStorageService.writeJson(SETTINGS_FILE, settings);
    try {
      await SecureStore.deleteItemAsync(`${STORAGE_KEYS.CREDENTIALS}_${id}`);
    } catch {}
  }

  static async switchToConfig(id: string): Promise<void> {
    const settings = this.listConfigs();
    const config = settings.configs.find((c) => c.id === id);
    if (!config) throw new Error('Config not found');
    settings.activeConfigId = id;
    config.lastUsedAt = Date.now();
    AppStorageService.writeJson(SETTINGS_FILE, settings);
  }

  static secureStoreKey(configId: string): string {
    return `${STORAGE_KEYS.CREDENTIALS}_${configId}`;
  }

  static async saveCredentials(configId: string, creds: NavidromeCredentials, password?: string): Promise<void> {
    if (password != null) {
      try {
        const encryptedPassword = await CryptoService.encrypt(password);
        this.saveSettingsForConfig(configId, { url: creds.url, username: creds.username, password: encryptedPassword });
        console.log(`[NavidromeService] Saved encrypted settings for config ${configId}`);
      } catch (error) {
        console.error('Error saving Navidrome settings:', error);
      }
    }
    try {
      await SecureStore.setItemAsync(this.secureStoreKey(configId), JSON.stringify(creds));
    } catch (error) {
      console.error('Error saving Navidrome credentials to SecureStore:', error);
    }
  }

  static async loadCredentials(configId?: string): Promise<NavidromeCredentials | null> {
    const targetId = configId || this.getActiveConfig()?.id;
    if (!targetId) return null;
    try {
      const settings = this.loadSettingsForConfig(targetId);
      if (settings?.url && settings.username && settings.password) {
        try {
          const password = await CryptoService.decrypt(settings.password);
          const salt = generateSalt();
          const token = NavidromeService.createToken(password, salt);
          const creds: NavidromeCredentials = { url: settings.url, username: settings.username, token, salt };
          await SecureStore.setItemAsync(this.secureStoreKey(targetId), JSON.stringify(creds));
          return creds;
        } catch (error) {
          console.error('Error decrypting Navidrome password:', error);
        }
      }
      if (settings?.url && settings.username && settings.token && settings.salt) {
        try {
          const [token, salt] = await Promise.all([
            CryptoService.decrypt(settings.token),
            CryptoService.decrypt(settings.salt),
          ]);
          const creds: NavidromeCredentials = { url: settings.url, username: settings.username, token, salt };
          await SecureStore.setItemAsync(this.secureStoreKey(targetId), JSON.stringify(creds));
          return creds;
        } catch (error) {
          console.error('Error decrypting Navidrome token snapshot:', error);
        }
      }
      let data = await SecureStore.getItemAsync(this.secureStoreKey(targetId));
      if (data) {
        const creds = JSON.parse(data) as NavidromeCredentials;
        if (!settings?.password && !settings?.token && creds.url && creds.username && creds.token && creds.salt) {
          try {
            const [token, salt] = await Promise.all([
              CryptoService.encrypt(creds.token),
              CryptoService.encrypt(creds.salt),
            ]);
            this.saveSettingsForConfig(targetId, { url: creds.url, username: creds.username, token, salt });
            console.log(`[NavidromeService] Wrote token snapshot for config ${targetId}`);
          } catch (error) {
            console.error('Error writing Navidrome token snapshot:', error);
          }
        }
        return creds;
      }
      return null;
    } catch (error) {
      console.error('Error loading Navidrome credentials:', error);
      return null;
    }
  }

  static async loadSavedLogin(configId?: string): Promise<{ url: string; username: string; password: string } | null> {
    const targetId = configId || this.getActiveConfig()?.id;
    if (!targetId) return null;
    const settings = this.loadSettingsForConfig(targetId);
    if (!settings?.url || !settings.username || !settings.password) return null;
    try {
      const password = await CryptoService.decrypt(settings.password);
      return { url: settings.url, username: settings.username, password };
    } catch (error) {
      console.error('Error loading saved Navidrome login:', error);
      return null;
    }
  }

  static async clearCredentials(configId?: string): Promise<void> {
    const targetId = configId || this.getActiveConfig()?.id;
    try {
      if (targetId) {
        await SecureStore.deleteItemAsync(this.secureStoreKey(targetId));
      }
      await AsyncStorage.removeItem(STORAGE_KEYS.LEGACY_ASYNC_CREDENTIALS);
      if (targetId) {
        this.removeSettingsForConfig(targetId);
      }
    } catch (error) {
      console.error('Error clearing Navidrome credentials:', error);
    }
  }

  static saveSettingsForConfig(configId: string, settings: NavidromeSettings): void {
    const all = this.listConfigs();
    const config = all.configs.find((c) => c.id === configId);
    if (!config) return;
    const settingsDir = AppStorageService.settingsDir;
    const { File } = require('expo-file-system');
    if (!settingsDir.exists) settingsDir.create({ intermediates: true });
    const file = new File(settingsDir, `navidrome-${configId}.json`);
    file.write(JSON.stringify(settings, null, 2));
  }

  static loadSettingsForConfig(configId: string): NavidromeSettings | null {
    const settingsDir = AppStorageService.settingsDir;
    const { File } = require('expo-file-system');
    const file = new File(settingsDir, `navidrome-${configId}.json`);
    if (!file.exists) return null;
    try {
      return JSON.parse(file.textSync()) as NavidromeSettings;
    } catch {
      return null;
    }
  }

  static removeSettingsForConfig(configId: string): void {
    const settingsDir = AppStorageService.settingsDir;
    const { File } = require('expo-file-system');
    const file = new File(settingsDir, `navidrome-${configId}.json`);
    if (file.exists) {
      try { file.delete(); } catch {}
    }
  }

  static saveSettings(settings: NavidromeSettings): void {
    AppStorageService.writeJson(SETTINGS_FILE, settings);
  }

  static loadSettings(): NavidromeSettings | null {
    return AppStorageService.readJson<NavidromeSettings>(SETTINGS_FILE);
  }

  static createToken(password: string, salt: string): string {
    return md5(password + salt);
  }

  static buildUrl(creds: NavidromeCredentials, endpoint: string, params?: Record<string, string>): string {
    const baseUrl = creds.url.replace(/\/+$/, '');
    const queryParams: Record<string, string> = {
      u: creds.username,
      t: creds.token,
      s: creds.salt,
      v: '1.16.1',
      c: 'Coda',
      f: 'json',
      ...params,
    };
    const queryString = Object.entries(queryParams)
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .join('&');
    return `${baseUrl}/rest/${endpoint}.view?${queryString}`;
  }

  static getStreamUrl(creds: NavidromeCredentials, songId: string): string {
    return NavidromeService.buildUrl(creds, 'stream', { id: songId });
  }

  static getCoverArtUrl(creds: NavidromeCredentials, coverArtId: string, size?: number): string {
    const params: Record<string, string> = { id: coverArtId };
    if (size) params.size = size.toString();
    return NavidromeService.buildUrl(creds, 'getCoverArt', params);
  }

  static async apiCall<T>(creds: NavidromeCredentials, endpoint: string, params?: Record<string, string>): Promise<T> {
    const url = NavidromeService.buildUrl(creds, endpoint, params);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch(url, { signal: controller.signal });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const json = await response.json();
      const subsonicResponse = json['subsonic-response'];
      if (subsonicResponse?.status === 'failed') {
        throw new Error(subsonicResponse.error?.message || 'Subsonic API error');
      }
      return subsonicResponse as T;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  static async ping(url: string, username: string, password: string): Promise<{ ok: boolean; error?: string; creds?: NavidromeCredentials }> {
    try {
      const salt = generateSalt();
      const token = NavidromeService.createToken(password, salt);
      const creds: NavidromeCredentials = { url, username, token, salt };
      await NavidromeService.apiCall(creds, 'ping');
      return { ok: true, creds };
    } catch (error: any) {
      return { ok: false, error: error.message || 'Connection failed' };
    }
  }

  static async getArtists(creds: NavidromeCredentials): Promise<NavidromeArtist[]> {
    try {
      const response = await NavidromeService.apiCall<any>(creds, 'getArtists');
      const artists = response?.['artists']?.['index'] || [];
      const result: NavidromeArtist[] = [];
      for (const index of artists) {
        for (const artist of index.artist || []) {
          result.push({
            id: artist.id,
            name: artist.name,
            albumCount: artist.albumCount,
            coverArt: artist.coverArt,
          });
        }
      }
      return result.sort((a, b) => a.name.localeCompare(b.name));
    } catch (error) {
      console.error('Error fetching artists:', error);
      return [];
    }
  }

  static async getArtist(creds: NavidromeCredentials, artistId: string): Promise<{ artist: NavidromeArtist; albums: NavidromeAlbum[] }> {
    try {
      const response = await NavidromeService.apiCall<any>(creds, 'getArtist', { id: artistId });
      const artistData = response?.['artist'];
      const artist: NavidromeArtist = {
        id: artistData.id,
        name: artistData.name,
        albumCount: artistData.albumCount,
        coverArt: artistData.coverArt,
      };
      const albums: NavidromeAlbum[] = (artistData.album || []).map((a: any) => ({
        id: a.id,
        name: a.name,
        artist: a.artist,
        artistId: a.artistId,
        songCount: a.songCount,
        coverArt: a.coverArt,
        year: a.year,
      }));
      return { artist, albums };
    } catch (error) {
      console.error('Error fetching artist:', error);
      return { artist: { id: artistId, name: 'Unknown' }, albums: [] };
    }
  }

  static async getAlbum(creds: NavidromeCredentials, albumId: string): Promise<{ album: NavidromeAlbum; songs: NavidromeSong[] }> {
    try {
      const response = await NavidromeService.apiCall<any>(creds, 'getAlbum', { id: albumId });
      const albumData = response?.['album'];
      const album: NavidromeAlbum = {
        id: albumData.id,
        name: albumData.name,
        artist: albumData.artist,
        artistId: albumData.artistId,
        songCount: albumData.songCount,
        coverArt: albumData.coverArt,
        year: albumData.year,
      };
      const songs: NavidromeSong[] = (albumData.song || []).map((s: any) => ({
        id: s.id,
        title: s.title,
        artist: s.artist,
        artistId: s.artistId,
        album: s.album,
        albumId: s.albumId,
        duration: s.duration,
        track: s.track,
        coverArt: s.coverArt,
      }));
      return { album, songs };
    } catch (error) {
      console.error('Error fetching album:', error);
      return { album: { id: albumId, name: 'Unknown' }, songs: [] };
    }
  }

  static async search(creds: NavidromeCredentials, query: string): Promise<{ artists: NavidromeArtist[]; albums: NavidromeAlbum[]; songs: NavidromeSong[] }> {
    try {
      const response = await NavidromeService.apiCall<any>(creds, 'search3', {
        query,
        artistCount: '10',
        albumCount: '10',
        songCount: '20',
      });
      const results = response?.['searchResult3'] || {};
      return {
        artists: (results.artist || []).map((a: any) => ({
          id: a.id,
          name: a.name,
          albumCount: a.albumCount,
          coverArt: a.coverArt,
        })),
        albums: (results.album || []).map((a: any) => ({
          id: a.id,
          name: a.name,
          artist: a.artist,
          artistId: a.artistId,
          songCount: a.songCount,
          coverArt: a.coverArt,
          year: a.year,
        })),
        songs: (results.song || []).map((s: any) => ({
          id: s.id,
          title: s.title,
          artist: s.artist,
          artistId: s.artistId,
          album: s.album,
          albumId: s.albumId,
          duration: s.duration,
          track: s.track,
          coverArt: s.coverArt,
        })),
      };
    } catch (error) {
      console.error('Error searching:', error);
      return { artists: [], albums: [], songs: [] };
    }
  }

  static songToTrackMetadata(creds: NavidromeCredentials, song: NavidromeSong): TrackMetadata {
    return {
      title: song.title,
      artist: song.artist || 'Unknown Artist',
      uri: NavidromeService.getStreamUrl(creds, song.id),
      duration: song.duration,
      artwork: song.coverArt ? NavidromeService.getCoverArtUrl(creds, song.coverArt, 300) : undefined,
      source: 'navidrome',
      navidromeId: song.id,
    };
  }
}
