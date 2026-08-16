import { File } from 'expo-file-system';
import { AppStorageService } from './AppStorageService';
import { NavidromeCredentials, NavidromeService } from './NavidromeService';
import { TrackMetadata } from '../context/AudioContext';

const AUDIO_CACHE_DIR = AppStorageService.audioCacheDir;
const ARTWORK_CACHE_DIR = AppStorageService.artworkCacheDir;

function ensureDirs() {
  if (!AUDIO_CACHE_DIR.exists) AUDIO_CACHE_DIR.create({ intermediates: true });
  if (!ARTWORK_CACHE_DIR.exists) ARTWORK_CACHE_DIR.create({ intermediates: true });
}

export class DownloadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DownloadError';
  }
}

export class OfflineCacheService {
  private static activeControllers = new Map<string, AbortController>();

  static getAbortController(uri: string): AbortController {
    const existing = this.activeControllers.get(uri);
    if (existing) existing.abort();
    const controller = new AbortController();
    this.activeControllers.set(uri, controller);
    return controller;
  }

  static cancelDownload(uri: string): void {
    const controller = this.activeControllers.get(uri);
    if (controller) {
      controller.abort();
      this.activeControllers.delete(uri);
    }
  }

  static removeController(uri: string): void {
    this.activeControllers.delete(uri);
  }

  static isTrackCached(track: TrackMetadata): boolean {
    if (!track.cachedUri || !track.navidromeId) return false;
    return new File(track.cachedUri).exists;
  }

  static async downloadTrack(
    creds: NavidromeCredentials,
    track: TrackMetadata,
    onProgress?: (progress: number) => void,
    signal?: AbortSignal,
  ): Promise<string> {
    if (!track.navidromeId) throw new DownloadError('Invalid track');

    ensureDirs();
    const destFile = new File(AUDIO_CACHE_DIR, `${track.navidromeId}.mp3`);
    if (destFile.exists) return destFile.uri;

    const controller = new AbortController();
    const callerAborted = { current: false };
    if (signal) {
      signal.addEventListener('abort', () => {
        callerAborted.current = true;
        controller.abort();
      });
    }
    const timeoutId = setTimeout(() => controller.abort(), 60_000);

    try {
      const url = NavidromeService.getStreamUrl(creds, track.navidromeId);
      let response: Response;
      try {
        response = await fetch(url, { signal: controller.signal });
      } catch (err: any) {
        clearTimeout(timeoutId);
        if (err?.name === 'AbortError') {
          if (callerAborted.current) throw err;
          throw new DownloadError('Download timed out');
        }
        if (err instanceof TypeError) {
          throw new DownloadError("Can't reach server");
        }
        throw new DownloadError('Network error');
      }
      clearTimeout(timeoutId);

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          throw new DownloadError('Server refused — check credentials');
        }
        if (response.status === 404) {
          throw new DownloadError('Track not found on server');
        }
        throw new DownloadError(`Server error (HTTP ${response.status})`);
      }

      let data: Uint8Array;
      try {
        const reader = response.body?.getReader();
        if (!reader) throw new Error('No reader');
        const contentLength = Number(response.headers.get('content-length')) || 0;
        const chunks: Uint8Array[] = [];
        let received = 0;
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value);
          received += value.length;
          if (contentLength > 0) {
            onProgress?.(received / contentLength);
          } else {
            onProgress?.(-(received / 1024));
          }
        }
        data = new Uint8Array(received);
        let offset = 0;
        for (const chunk of chunks) {
          data.set(chunk, offset);
          offset += chunk.length;
        }
      } catch {
        const arrayBuffer = await response.arrayBuffer();
        data = new Uint8Array(arrayBuffer);
      }
      destFile.write(data);
      onProgress?.(1);
      return destFile.uri;
    } catch (error: any) {
      clearTimeout(timeoutId);
      if (error instanceof DownloadError) throw error;
      if (error?.name === 'AbortError') {
        if (callerAborted.current) throw error;
        throw new DownloadError('Download timed out');
      }
      console.error('Download failed:', error?.message || error);
      throw new DownloadError(error?.message || 'Download failed');
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

      const arrayBuffer = await response.arrayBuffer();
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

  static scanCacheDirectory(): { audio: Map<string, string>; artwork: Map<string, string> } {
    const audio = new Map<string, string>();
    const artwork = new Map<string, string>();

    if (AUDIO_CACHE_DIR.exists) {
      for (const entry of AUDIO_CACHE_DIR.list()) {
        if (entry instanceof File && entry.name.endsWith('.mp3')) {
          const navidromeId = entry.name.replace('.mp3', '');
          audio.set(navidromeId, entry.uri);
        }
      }
    }
    if (ARTWORK_CACHE_DIR.exists) {
      for (const entry of ARTWORK_CACHE_DIR.list()) {
        if (entry instanceof File && entry.name.endsWith('.jpg')) {
          const artworkId = entry.name.replace('.jpg', '');
          artwork.set(artworkId, entry.uri);
        }
      }
    }
    return { audio, artwork };
  }

  static async downloadTrackForOffline(
    creds: NavidromeCredentials,
    track: TrackMetadata,
    onProgress?: (progress: number) => void,
    signal?: AbortSignal,
  ): Promise<TrackMetadata> {
    const cachedAudio = await OfflineCacheService.downloadTrack(creds, track, onProgress, signal);

    let cachedArt = track.cachedArtwork;
    if (track.artwork && track.navidromeId) {
      const coverArtId = track.artwork.match(/id=([^&]+)/)?.[1];
      if (coverArtId) {
        OfflineCacheService.downloadArtwork(creds, coverArtId).catch(() => {});
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
