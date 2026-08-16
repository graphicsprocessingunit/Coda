import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import md5 from 'md5';
import { AppStorageService } from './AppStorageService';
import { TrackMetadata } from '../context/AudioContext';

const STORAGE_KEYS = {
  CREDENTIALS: '@coda_navidrome_credentials',
};

const SETTINGS_FILE = 'navidrome-settings.json';

export interface NavidromeCredentials {
  url: string;
  username: string;
  token: string;
  salt: string;
}

export interface NavidromeSettings {
  url: string;
  username: string;
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
  let salt = '';
  for (let i = 0; i < 16; i++) {
    salt += chars[Math.floor(Math.random() * chars.length)];
  }
  return salt;
}

export class NavidromeService {
  static async saveCredentials(creds: NavidromeCredentials): Promise<void> {
    try {
      await SecureStore.setItemAsync(STORAGE_KEYS.CREDENTIALS, JSON.stringify(creds));
      this.saveSettings({ url: creds.url, username: creds.username });
    } catch (error) {
      console.error('Error saving Navidrome credentials:', error);
    }
  }

  static async loadCredentials(): Promise<NavidromeCredentials | null> {
    try {
      let data = await SecureStore.getItemAsync(STORAGE_KEYS.CREDENTIALS);
      if (!data) {
        data = await AsyncStorage.getItem(STORAGE_KEYS.CREDENTIALS);
        if (data) {
          await SecureStore.setItemAsync(STORAGE_KEYS.CREDENTIALS, data);
          await AsyncStorage.removeItem(STORAGE_KEYS.CREDENTIALS);
        }
      }
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('Error loading Navidrome credentials:', error);
      return null;
    }
  }

  static async clearCredentials(): Promise<void> {
    try {
      await SecureStore.deleteItemAsync(STORAGE_KEYS.CREDENTIALS);
      await AsyncStorage.removeItem(STORAGE_KEYS.CREDENTIALS);
      AppStorageService.removeJson(SETTINGS_FILE);
    } catch (error) {
      console.error('Error clearing Navidrome credentials:', error);
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
