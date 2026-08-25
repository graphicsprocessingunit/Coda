import AsyncStorage from '@react-native-async-storage/async-storage';
import { TrackMetadata, Playlist, SmartPlaylist } from '../context/AudioContext';

const STORAGE_KEYS = {
  LIBRARY: '@coda_library',
  PLAYLISTS: '@coda_playlists',
  CURRENT_TRACK: '@coda_current_track',
  PLAYBACK_POSITION: '@coda_playback_position',
  QUEUE: '@coda_queue',
  SMART_PLAYLISTS: '@coda_smart_playlists',
};

let activeConfigId: string | null = null;

function scopedKey(base: string): string {
  return activeConfigId ? `${base}_${activeConfigId}` : base;
}

export class StorageService {
  static setActiveConfig(configId: string | null): void {
    activeConfigId = configId;
  }

  static getActiveConfigId(): string | null {
    return activeConfigId;
  }

  static async saveLibrary(library: TrackMetadata[]): Promise<void> {
    try {
      await AsyncStorage.setItem(scopedKey(STORAGE_KEYS.LIBRARY), JSON.stringify(library));
    } catch (error) {
      console.error('Error saving library:', error);
    }
  }

  static async loadLibrary(): Promise<TrackMetadata[]> {
    try {
      const data = await AsyncStorage.getItem(scopedKey(STORAGE_KEYS.LIBRARY));
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Error loading library:', error);
      return [];
    }
  }

  static async savePlaylists(playlists: Playlist[]): Promise<void> {
    try {
      await AsyncStorage.setItem(scopedKey(STORAGE_KEYS.PLAYLISTS), JSON.stringify(playlists));
    } catch (error) {
      console.error('Error saving playlists:', error);
    }
  }

  static async loadPlaylists(): Promise<Playlist[]> {
    try {
      const data = await AsyncStorage.getItem(scopedKey(STORAGE_KEYS.PLAYLISTS));
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Error loading playlists:', error);
      return [];
    }
  }

  static async saveCurrentTrack(track: TrackMetadata | null): Promise<void> {
    try {
      await AsyncStorage.setItem(scopedKey(STORAGE_KEYS.CURRENT_TRACK), JSON.stringify(track));
    } catch (error) {
      console.error('Error saving current track:', error);
    }
  }

  static async loadCurrentTrack(): Promise<TrackMetadata | null> {
    try {
      const data = await AsyncStorage.getItem(scopedKey(STORAGE_KEYS.CURRENT_TRACK));
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('Error loading current track:', error);
      return null;
    }
  }

  static async savePlaybackPosition(position: number): Promise<void> {
    try {
      await AsyncStorage.setItem(scopedKey(STORAGE_KEYS.PLAYBACK_POSITION), position.toString());
    } catch (error) {
      console.error('Error saving playback position:', error);
    }
  }

  static async loadPlaybackPosition(): Promise<number> {
    try {
      const data = await AsyncStorage.getItem(scopedKey(STORAGE_KEYS.PLAYBACK_POSITION));
      return data ? parseInt(data, 10) : 0;
    } catch (error) {
      console.error('Error loading playback position:', error);
      return 0;
    }
  }

  static async saveQueue(queue: TrackMetadata[]): Promise<void> {
    try {
      await AsyncStorage.setItem(scopedKey(STORAGE_KEYS.QUEUE), JSON.stringify(queue));
    } catch (error) {
      console.error('Error saving queue:', error);
    }
  }

  static async loadQueue(): Promise<TrackMetadata[]> {
    try {
      const data = await AsyncStorage.getItem(scopedKey(STORAGE_KEYS.QUEUE));
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Error loading queue:', error);
      return [];
    }
  }

  static async saveSmartPlaylists(smartPlaylists: SmartPlaylist[]): Promise<void> {
    try {
      await AsyncStorage.setItem(scopedKey(STORAGE_KEYS.SMART_PLAYLISTS), JSON.stringify(smartPlaylists));
    } catch (error) {
      console.error('Error saving smart playlists:', error);
    }
  }

  static async loadSmartPlaylists(): Promise<SmartPlaylist[]> {
    try {
      const data = await AsyncStorage.getItem(scopedKey(STORAGE_KEYS.SMART_PLAYLISTS));
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Error loading smart playlists:', error);
      return [];
    }
  }

  static async clearAll(): Promise<void> {
    try {
      for (const key of Object.values(STORAGE_KEYS)) {
        await AsyncStorage.removeItem(scopedKey(key));
      }
    } catch (error) {
      console.error('Error clearing storage:', error);
    }
  }
}
