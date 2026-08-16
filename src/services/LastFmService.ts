import * as SecureStore from 'expo-secure-store';
import md5 from 'md5';
import { AppStorageService } from './AppStorageService';
import { TrackMetadata } from '../context/AudioContext';

const STORAGE_KEY = '@coda_lastfm_credentials';
const SETTINGS_FILE = 'lastfm-settings.json';

export interface LastFmCredentials {
  apiKey: string;
  sharedSecret: string;
  sessionKey: string;
  username: string;
}

export interface LastFmSettings {
  username: string;
}

export class LastFmService {
  private static API_URL = 'https://ws.audioscrobbler.com/2.0/';

  static getAuthUrl(apiKey: string): string {
    return `https://www.last.fm/api/auth/?api_key=${apiKey}`;
  }

  static async getSession(
    token: string,
    apiKey: string,
    sharedSecret: string,
  ): Promise<{ sessionKey: string; username: string }> {
    const params: Record<string, string> = {
      method: 'auth.getSession',
      api_key: apiKey,
      token: token,
      format: 'json',
    };
    const apiSig = this.sign(params, sharedSecret);
    const url = this.buildUrl({ ...params, api_sig: apiSig });
    const response = await fetch(url);
    const data = await response.json();
    if (data.error) {
      throw new Error(data.message || 'Failed to get Last.fm session');
    }
    return {
      sessionKey: data.session.key,
      username: data.session.name,
    };
  }

  static async scrobble(
    creds: LastFmCredentials,
    track: TrackMetadata,
    timestamp: number,
  ): Promise<boolean> {
    try {
      const params: Record<string, string> = {
        method: 'track.scrobble',
        api_key: creds.apiKey,
        sk: creds.sessionKey,
        artist: track.artist,
        track: track.title,
        timestamp: timestamp.toString(),
        format: 'json',
      };
      if (track.album) params.album = track.album;
      if (track.duration) params.duration = Math.round(track.duration / 1000).toString();

      const apiSig = this.sign(params, creds.sharedSecret);
      const body = new URLSearchParams({ ...params, api_sig: apiSig });
      const response = await fetch(this.API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
      });
      const data = await response.json();
      return data.scrobbles?.['@attr']?.accepted === 1;
    } catch {
      return false;
    }
  }

  static async nowPlaying(
    creds: LastFmCredentials,
    track: TrackMetadata,
  ): Promise<boolean> {
    try {
      const params: Record<string, string> = {
        method: 'track.updateNowPlaying',
        api_key: creds.apiKey,
        sk: creds.sessionKey,
        artist: track.artist,
        track: track.title,
        format: 'json',
      };
      if (track.album) params.album = track.album;
      if (track.duration) params.duration = Math.round(track.duration / 1000).toString();

      const apiSig = this.sign(params, creds.sharedSecret);
      const body = new URLSearchParams({ ...params, api_sig: apiSig });
      const response = await fetch(this.API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
      });
      const data = await response.json();
      return !data.error;
    } catch {
      return false;
    }
  }

  private static sign(params: Record<string, string>, sharedSecret: string): string {
    const sorted = Object.keys(params)
      .filter(k => k !== 'format' && k !== 'callback')
      .sort()
      .map(k => `${k}${params[k]}`)
      .join('');
    return md5(sorted + sharedSecret);
  }

  private static buildUrl(params: Record<string, string>): string {
    const qs = Object.entries(params)
      .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
      .join('&');
    return `${this.API_URL}?${qs}`;
  }

  static async saveCredentials(creds: LastFmCredentials): Promise<void> {
    try {
      await SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(creds));
      AppStorageService.writeJson(SETTINGS_FILE, { username: creds.username });
    } catch (error) {
      console.error('Error saving Last.fm credentials:', error);
    }
  }

  static async loadCredentials(): Promise<LastFmCredentials | null> {
    try {
      const data = await SecureStore.getItemAsync(STORAGE_KEY);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('Error loading Last.fm credentials:', error);
      return null;
    }
  }

  static loadSettings(): LastFmSettings | null {
    return AppStorageService.readJson<LastFmSettings>(SETTINGS_FILE);
  }

  static async clearCredentials(): Promise<void> {
    try {
      await SecureStore.deleteItemAsync(STORAGE_KEY);
      AppStorageService.removeJson(SETTINGS_FILE);
    } catch (error) {
      console.error('Error clearing Last.fm credentials:', error);
    }
  }
}
