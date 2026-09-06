import { File, Directory } from 'expo-file-system';
import { AppStorageService } from './AppStorageService';
import { NavidromeCredentials, NavidromeService } from './NavidromeService';
import { TrackMetadata } from '../context/AudioContext';

let activeConfigId: string | null = null;

function sanitizeFileId(id: string): string {
  return id.replace(/[/\\.\x00]/g, '');
}

export interface BatchDownloadResult {
  succeeded: TrackMetadata[];
  failed: { track: TrackMetadata; error: string }[];
  skipped: TrackMetadata[];
}

export interface DownloadTracksOptions {
  concurrency?: number;
  signal?: AbortSignal;
  onTrackStart?: (track: TrackMetadata) => void;
  onTrackProgress?: (track: TrackMetadata, progress: number) => void;
  onTrackComplete?: (track: TrackMetadata, offlineTrack: TrackMetadata) => void;
  onTrackError?: (track: TrackMetadata, error: string) => void;
}

function combineSignals(...signals: (AbortSignal | undefined)[]): AbortSignal | undefined {
  const active = signals.filter((s): s is AbortSignal => !!s);
  if (active.length === 0) return undefined;
  if (active.length === 1) return active[0];
  try {
    if (typeof (AbortSignal as any).any === 'function') {
      return (AbortSignal as any).any(active);
    }
  } catch {}
  const controller = new AbortController();
  const onAbort = () => controller.abort();
  for (const signal of active) {
    if (signal.aborted) {
      controller.abort();
      break;
    }
    signal.addEventListener('abort', onAbort, { once: true });
  }
  return controller.signal;
}

export class DownloadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DownloadError';
  }
}

export class OfflineCacheService {
  private static activeControllers = new Map<string, AbortController>();

  static setActiveConfig(configId: string | null): void {
    activeConfigId = configId;
  }

  static getActiveConfigId(): string | null {
    return activeConfigId;
  }

  private static getAudioDir(): Directory {
    if (!activeConfigId) throw new Error('No active server config');
    const dir = AppStorageService.getAudioCacheDir(activeConfigId);
    if (!dir.exists) dir.create({ intermediates: true });
    return dir;
  }

  private static getArtworkDir(): Directory {
    if (!activeConfigId) throw new Error('No active server config');
    const dir = AppStorageService.getArtworkCacheDir(activeConfigId);
    if (!dir.exists) dir.create({ intermediates: true });
    return dir;
  }

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
    if (track.cachedUri) {
      try {
        if (new File(track.cachedUri).exists) return true;
      } catch {}
    }
    if (!track.navidromeId || !activeConfigId) return false;
    try {
      const audioDir = AppStorageService.getAudioCacheDir(activeConfigId);
      return new File(audioDir, `${sanitizeFileId(track.navidromeId)}.mp3`).exists;
    } catch {
      return false;
    }
  }

  static async downloadTrack(
    creds: NavidromeCredentials,
    track: TrackMetadata,
    onProgress?: (progress: number) => void,
    signal?: AbortSignal,
  ): Promise<string> {
    if (!track.navidromeId) throw new DownloadError('Invalid track');

    const audioDir = this.getAudioDir();
    const destFile = new File(audioDir, `${sanitizeFileId(track.navidromeId)}.mp3`);
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
    const artworkDir = this.getArtworkDir();
    const destFile = new File(artworkDir, `${sanitizeFileId(coverArtId)}.jpg`);
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
    try {
      const audioDir = this.getAudioDir();
      const file = new File(audioDir, `${sanitizeFileId(navidromeId)}.mp3`);
      if (file.exists) file.delete();
    } catch {}
  }

  static clearCache(): void {
    if (!activeConfigId) return;
    try {
      const audioDir = AppStorageService.getAudioCacheDir(activeConfigId);
      const artworkDir = AppStorageService.getArtworkCacheDir(activeConfigId);
      if (audioDir.exists) audioDir.delete();
      if (artworkDir.exists) artworkDir.delete();
    } catch {}
  }

  static getCacheSize(): number {
    if (!activeConfigId) return 0;
    let total = 0;
    try {
      const audioDir = AppStorageService.getAudioCacheDir(activeConfigId);
      const artworkDir = AppStorageService.getArtworkCacheDir(activeConfigId);
      if (audioDir.exists) {
        for (const entry of audioDir.list()) {
          if (entry instanceof File) total += entry.size;
        }
      }
      if (artworkDir.exists) {
        for (const entry of artworkDir.list()) {
          if (entry instanceof File) total += entry.size;
        }
      }
    } catch {}
    return total;
  }

  static scanCacheDirectory(): { audio: Map<string, string>; artwork: Map<string, string> } {
    const audio = new Map<string, string>();
    const artwork = new Map<string, string>();
    if (!activeConfigId) return { audio, artwork };

    try {
      const audioDir = AppStorageService.getAudioCacheDir(activeConfigId);
      const artworkDir = AppStorageService.getArtworkCacheDir(activeConfigId);

      if (audioDir.exists) {
        for (const entry of audioDir.list()) {
          if (entry instanceof File && entry.name.endsWith('.mp3')) {
            const navidromeId = entry.name.replace('.mp3', '');
            audio.set(navidromeId, entry.uri);
          }
        }
      }
      if (artworkDir.exists) {
        for (const entry of artworkDir.list()) {
          if (entry instanceof File && entry.name.endsWith('.jpg')) {
            const artworkId = entry.name.replace('.jpg', '');
            artwork.set(artworkId, entry.uri);
          }
        }
      }
    } catch (error) {
      console.error('Error scanning cache directory:', error);
    }
    return { audio, artwork };
  }

  static async migrateDownloads(configId: string): Promise<void> {
    const { Paths } = require('expo-file-system');
    const legacyAudio = new Directory(Paths.document, 'Coda', 'Downloads', 'audio');
    const legacyArtwork = new Directory(Paths.document, 'Coda', 'Downloads', 'artwork');
    const targetAudio = AppStorageService.getAudioCacheDir(configId);
    const targetArtwork = AppStorageService.getArtworkCacheDir(configId);

    if (!targetAudio.exists) targetAudio.create({ intermediates: true });
    if (!targetArtwork.exists) targetArtwork.create({ intermediates: true });

    if (legacyAudio.exists) {
      try {
        for (const entry of legacyAudio.list()) {
          if (entry instanceof File) {
            const dest = new File(targetAudio, entry.name);
            if (!dest.exists) entry.move(targetAudio);
          }
        }
        legacyAudio.delete();
      } catch (error) {
        console.error('[Migration] Error moving audio cache:', error);
      }
    }

    if (legacyArtwork.exists) {
      try {
        for (const entry of legacyArtwork.list()) {
          if (entry instanceof File) {
            const dest = new File(targetArtwork, entry.name);
            if (!dest.exists) entry.move(targetArtwork);
          }
        }
        legacyArtwork.delete();
      } catch (error) {
        console.error('[Migration] Error moving artwork cache:', error);
      }
    }
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

  static async downloadTracks(
    creds: NavidromeCredentials,
    tracks: TrackMetadata[],
    options: DownloadTracksOptions = {},
  ): Promise<BatchDownloadResult> {
    const concurrency = Math.max(1, options.concurrency ?? 3);
    const signal = options.signal;
    if (signal?.aborted) throw new Error('Batch cancelled');

    const seen = new Set<string>();
    const work: TrackMetadata[] = [];
    const skipped: TrackMetadata[] = [];
    for (const track of tracks) {
      if (track.source !== 'navidrome' || !track.navidromeId) continue;
      const id = track.navidromeId;
      if (seen.has(id)) continue;
      seen.add(id);
      if (OfflineCacheService.isTrackCached(track)) {
        skipped.push(track);
      } else {
        work.push(track);
      }
    }

    const succeeded: TrackMetadata[] = [];
    const failed: { track: TrackMetadata; error: string }[] = [];
    let nextIndex = 0;

    const worker = async () => {
      while (nextIndex < work.length) {
        if (signal?.aborted) break;
        const index = nextIndex++;
        const track = work[index];
        if (!track.navidromeId) continue;

        const perTrackController = OfflineCacheService.getAbortController(track.uri);
        const effectiveSignal = combineSignals(signal, perTrackController.signal);
        options.onTrackStart?.(track);

        try {
          const offlineTrack = await OfflineCacheService.downloadTrackForOffline(
            creds,
            track,
            (progress) => options.onTrackProgress?.(track, progress),
            effectiveSignal,
          );
          if (!offlineTrack.cachedUri) throw new DownloadError('Download failed');
          succeeded.push(offlineTrack);
          options.onTrackComplete?.(track, offlineTrack);
        } catch (error: any) {
          if (error?.name === 'AbortError') {
            OfflineCacheService.removeController(track.uri);
            try {
              const partial = new File(this.getAudioDir(), `${sanitizeFileId(track.navidromeId)}.mp3`);
              if (partial.exists) partial.delete();
            } catch {}
            if (signal?.aborted) break;
            continue;
          }
          const message = error?.message || 'Download failed';
          failed.push({ track, error: message });
          options.onTrackError?.(track, message);
        } finally {
          OfflineCacheService.removeController(track.uri);
        }
      }
    };

    await Promise.all(
      Array.from({ length: Math.min(concurrency, Math.max(work.length, 1)) }, () => worker()),
    );

    return { succeeded, failed, skipped };
  }
}
