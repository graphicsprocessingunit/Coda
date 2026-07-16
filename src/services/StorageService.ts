import AsyncStorage from '@react-native-async-storage/async-storage';
import { TrackMetadata, Playlist } from '../context/AudioContext';

const STORAGE_KEYS = {
  LIBRARY: '@coda_library',
  PLAYLISTS: '@coda_playlists',
  CURRENT_TRACK: '@coda_current_track',
  PLAYBACK_POSITION: '@coda_playback_position',
  QUEUE: '@coda_queue',
};

export class StorageService {
  static async saveLibrary(library: TrackMetadata[]): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.LIBRARY, JSON.stringify(library));
    } catch (error) {
      console.error('Error saving library:', error);
    }
  }

  static async loadLibrary(): Promise<TrackMetadata[]> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.LIBRARY);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Error loading library:', error);
      return [];
    }
  }

  static async savePlaylists(playlists: Playlist[]): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.PLAYLISTS, JSON.stringify(playlists));
    } catch (error) {
      console.error('Error saving playlists:', error);
    }
  }

  static async loadPlaylists(): Promise<Playlist[]> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.PLAYLISTS);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Error loading playlists:', error);
      return [];
    }
  }

  static async saveCurrentTrack(track: TrackMetadata | null): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.CURRENT_TRACK, JSON.stringify(track));
    } catch (error) {
      console.error('Error saving current track:', error);
    }
  }

  static async loadCurrentTrack(): Promise<TrackMetadata | null> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.CURRENT_TRACK);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('Error loading current track:', error);
      return null;
    }
  }

  static async savePlaybackPosition(position: number): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.PLAYBACK_POSITION, position.toString());
    } catch (error) {
      console.error('Error saving playback position:', error);
    }
  }

  static async loadPlaybackPosition(): Promise<number> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.PLAYBACK_POSITION);
      return data ? parseInt(data, 10) : 0;
    } catch (error) {
      console.error('Error loading playback position:', error);
      return 0;
    }
  }

  static async saveQueue(queue: TrackMetadata[]): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.QUEUE, JSON.stringify(queue));
    } catch (error) {
      console.error('Error saving queue:', error);
    }
  }

  static async loadQueue(): Promise<TrackMetadata[]> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.QUEUE);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Error loading queue:', error);
      return [];
    }
  }

  static async clearAll(): Promise<void> {
    try {
      for (const key of Object.values(STORAGE_KEYS)) {
        await AsyncStorage.removeItem(key);
      }
    } catch (error) {
      console.error('Error clearing storage:', error);
    }
  }
}
