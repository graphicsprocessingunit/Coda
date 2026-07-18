import { File, Directory, Paths } from 'expo-file-system';
import { NavidromeCredentials, NavidromeService } from './NavidromeService';
import { TrackMetadata } from '../context/AudioContext';

const AUDIO_CACHE_DIR = new Directory(Paths.document, 'cache/navidrome/audio');
const ARTWORK_CACHE_DIR = new Directory(Paths.document, 'cache/navidrome/artwork');

function ensureDirs() {
  if (!AUDIO_CACHE_DIR.exists) AUDIO_CACHE_DIR.create();
  if (!ARTWORK_CACHE_DIR.exists) ARTWORK_CACHE_DIR.create();
}

export class OfflineCacheService {
  static isTrackCached(track: TrackMetadata): boolean {
    if (!track.cachedUri || !track.navidromeId) return false;
    return new File(track.cachedUri).exists;
  }

  static async downloadTrack(
    creds: NavidromeCredentials,
    track: TrackMetadata,
    onProgress?: (progress: number) => void,
  ): Promise<string | null> {
    if (!track.navidromeId) return null;

    ensureDirs();
    const destFile = new File(AUDIO_CACHE_DIR, `${track.navidromeId}.mp3`);
    if (destFile.exists) return destFile.uri;

    try {
      const url = NavidromeService.getStreamUrl(creds, track.navidromeId);
      const response = await fetch(url);
      if (!response.ok) return null;

      const blob = await response.blob();
      const arrayBuffer = await blob.arrayBuffer();
      const uint8 = new Uint8Array(arrayBuffer);
      destFile.write(uint8);
      onProgress?.(1);
      return destFile.uri;
    } catch (error) {
      console.error('Error downloading track:', error);
      return null;
    }
  }

  static async downloadArtwork(
    creds: NavidromeCredentials,
    coverArtId: string,
  ): Promise<string | null> {
    ensureDirs();
    const destFile = new File(ARTWORK_CACHE_DIR, `${coverArtId}.jpg`);
    if (destFile.exists) return destFile.uri;

    try {
      const url = NavidromeService.getCoverArtUrl(creds, coverArtId, 300);
      const response = await fetch(url);
      if (!response.ok) return null;

      const blob = await response.blob();
      const arrayBuffer = await blob.arrayBuffer();
      const uint8 = new Uint8Array(arrayBuffer);
      destFile.write(uint8);
      return destFile.uri;
    } catch (error) {
      console.error('Error downloading artwork:', error);
      return null;
    }
  }

  static async removeCachedTrack(navidromeId: string): Promise<void> {
    const file = new File(AUDIO_CACHE_DIR, `${navidromeId}.mp3`);
    if (file.exists) file.delete();
  }

  static clearCache(): void {
    if (AUDIO_CACHE_DIR.exists) AUDIO_CACHE_DIR.delete();
    if (ARTWORK_CACHE_DIR.exists) ARTWORK_CACHE_DIR.delete();
  }

  static getCacheSize(): number {
    let total = 0;
    if (AUDIO_CACHE_DIR.exists) {
      for (const entry of AUDIO_CACHE_DIR.list()) {
        if (entry instanceof File) total += entry.size;
      }
    }
    if (ARTWORK_CACHE_DIR.exists) {
      for (const entry of ARTWORK_CACHE_DIR.list()) {
        if (entry instanceof File) total += entry.size;
      }
    }
    return total;
  }

  static async downloadTrackForOffline(
    creds: NavidromeCredentials,
    track: TrackMetadata,
  ): Promise<TrackMetadata> {
    const cachedAudio = await OfflineCacheService.downloadTrack(creds, track);
    let cachedArt = track.cachedArtwork;

    if (track.artwork && track.navidromeId) {
      const coverArtId = track.artwork.match(/id=([^&]+)/)?.[1];
      if (coverArtId) {
        cachedArt = await OfflineCacheService.downloadArtwork(creds, coverArtId) || cachedArt;
      }
    }

    return {
      ...track,
      cachedUri: cachedAudio || track.cachedUri,
      cachedArtwork: cachedArt,
      artwork: cachedArt || track.artwork,
    };
  }
}
