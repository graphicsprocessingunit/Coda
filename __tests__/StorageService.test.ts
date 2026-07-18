import AsyncStorage from '@react-native-async-storage/async-storage';
import { StorageService } from '../src/services/StorageService';
import type { TrackMetadata, Playlist } from '../src/context/AudioContext';

const mockTrack: TrackMetadata = {
  title: 'Test Song',
  artist: 'Test Artist',
  uri: 'file:///test.mp3',
};

const mockPlaylist: Playlist = {
  id: 'pl1',
  name: 'Test Playlist',
  tracks: [mockTrack],
  createdAt: Date.now(),
};

describe('StorageService', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  describe('library', () => {
    it('returns empty array when nothing saved', async () => {
      const lib = await StorageService.loadLibrary();
      expect(lib).toEqual([]);
    });

    it('saves and loads library', async () => {
      await StorageService.saveLibrary([mockTrack]);
      const lib = await StorageService.loadLibrary();
      expect(lib).toHaveLength(1);
      expect(lib[0].title).toBe('Test Song');
    });
  });

  describe('playlists', () => {
    it('returns empty array when nothing saved', async () => {
      const pl = await StorageService.loadPlaylists();
      expect(pl).toEqual([]);
    });

    it('saves and loads playlists', async () => {
      await StorageService.savePlaylists([mockPlaylist]);
      const pl = await StorageService.loadPlaylists();
      expect(pl).toHaveLength(1);
      expect(pl[0].name).toBe('Test Playlist');
    });
  });

  describe('currentTrack', () => {
    it('returns null when nothing saved', async () => {
      const track = await StorageService.loadCurrentTrack();
      expect(track).toBeNull();
    });

    it('saves and loads current track', async () => {
      await StorageService.saveCurrentTrack(mockTrack);
      const track = await StorageService.loadCurrentTrack();
      expect(track?.title).toBe('Test Song');
    });
  });

  describe('playbackPosition', () => {
    it('returns 0 when nothing saved', async () => {
      const pos = await StorageService.loadPlaybackPosition();
      expect(pos).toBe(0);
    });

    it('saves and loads position', async () => {
      await StorageService.savePlaybackPosition(42000);
      const pos = await StorageService.loadPlaybackPosition();
      expect(pos).toBe(42000);
    });
  });

  describe('queue', () => {
    it('returns empty array when nothing saved', async () => {
      const q = await StorageService.loadQueue();
      expect(q).toEqual([]);
    });

    it('saves and loads queue', async () => {
      await StorageService.saveQueue([mockTrack]);
      const q = await StorageService.loadQueue();
      expect(q).toHaveLength(1);
    });
  });

  describe('clearAll', () => {
    it('clears all stored data', async () => {
      await StorageService.saveLibrary([mockTrack]);
      await StorageService.savePlaylists([mockPlaylist]);
      await StorageService.saveCurrentTrack(mockTrack);
      await StorageService.savePlaybackPosition(1000);
      await StorageService.saveQueue([mockTrack]);

      await StorageService.clearAll();

      expect(await StorageService.loadLibrary()).toEqual([]);
      expect(await StorageService.loadPlaylists()).toEqual([]);
      expect(await StorageService.loadCurrentTrack()).toBeNull();
      expect(await StorageService.loadPlaybackPosition()).toBe(0);
      expect(await StorageService.loadQueue()).toEqual([]);
    });
  });
});
