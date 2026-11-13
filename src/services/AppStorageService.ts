import { File, Directory, Paths } from 'expo-file-system';

const AUDIO_EXTENSIONS = ['mp3', 'm4a', 'wav', 'flac', 'aac', 'ogg', 'aif', 'aiff', 'opus'];

const DOWNLOADS_ROOT = new Directory(Paths.document, 'Coda', 'Downloads');
const AUDIO_CACHE_DIR = new Directory(Paths.document, 'Coda', 'Downloads', 'audio');
const ARTWORK_CACHE_DIR = new Directory(Paths.document, 'Coda', 'Downloads', 'artwork');
const MUSIC_DIR = new Directory(Paths.document, 'Coda', 'Music');
const SETTINGS_DIR = new Directory(Paths.document, 'Coda', 'Settings');

const LEGACY_AUDIO_CACHE_DIR = new Directory(Paths.document, 'cache/navidrome/audio');
const LEGACY_ARTWORK_CACHE_DIR = new Directory(Paths.document, 'cache/navidrome/artwork');

export interface StorageUsage {
  downloadedTracks: number;
  downloadedArtwork: number;
  importedMusic: number;
  settings: number;
  total: number;
}

function dirSize(dir: Directory): number {
  if (!dir.exists) return 0;
  let total = 0;
  try {
    for (const entry of dir.list()) {
      if (entry instanceof File) total += entry.size ?? 0;
      else if (entry instanceof Directory) total += dirSize(entry);
    }
  } catch (error) {
    console.error('Error measuring directory:', error);
  }
  return total;
}

/**
 * Download dirs exist once per server config (`Downloads/<configId>/<sub>`) plus, on installs
 * that predate multi-server support, directly under `Downloads/<sub>`.
 */
function listDownloadDirs(sub: 'audio' | 'artwork'): Directory[] {
  const dirs: Directory[] = [];
  if (!DOWNLOADS_ROOT.exists) return dirs;
  try {
    for (const entry of DOWNLOADS_ROOT.list()) {
      if (!(entry instanceof Directory)) continue;
      if (entry.name === sub) {
        dirs.push(entry);
        continue;
      }
      const nested = new Directory(entry, sub);
      if (nested.exists) dirs.push(nested);
    }
  } catch (error) {
    console.error('Error scanning download directories:', error);
  }
  return dirs;
}

function ensureDir(dir: Directory): void {
  if (!dir.exists) dir.create({ intermediates: true });
}

/** Removes a directory tree, deleting files first so this doesn't depend on recursive delete. */
function removeDir(dir: Directory): void {
  if (!dir.exists) return;
  for (const entry of dir.list()) {
    if (entry instanceof File) entry.delete();
    else removeDir(entry);
  }
  dir.delete();
}

function moveFilesFrom(source: Directory, dest: Directory): boolean {
  if (!source.exists) return false;
  ensureDir(dest);
  let moved = false;
  try {
    for (const entry of source.list()) {
      if (entry instanceof File) {
        entry.move(dest);
        moved = true;
      }
    }
  } catch (error) {
    console.error('Error migrating cache directory:', error);
  }
  try {
    source.delete();
  } catch (error) {
    console.error('Error removing legacy cache directory:', error);
  }
  return moved;
}

export class AppStorageService {
  static readonly ROOT_NAME = 'Coda';
  static readonly DOWNLOADS_NAME = 'Downloads';
  static readonly AUDIO_NAME = 'audio';
  static readonly ARTWORK_NAME = 'artwork';
  static readonly MUSIC_NAME = 'Music';
  static readonly SETTINGS_NAME = 'Settings';

  static get audioCacheDir(): Directory {
    return AUDIO_CACHE_DIR;
  }

  static get artworkCacheDir(): Directory {
    return ARTWORK_CACHE_DIR;
  }

  static get musicDir(): Directory {
    return MUSIC_DIR;
  }

  static get settingsDir(): Directory {
    return SETTINGS_DIR;
  }

  static getAudioCacheDir(configId: string): Directory {
    return new Directory(DOWNLOADS_ROOT, configId, 'audio');
  }

  static getArtworkCacheDir(configId: string): Directory {
    return new Directory(DOWNLOADS_ROOT, configId, 'artwork');
  }

  /** Offline Navidrome tracks for every server config (plus the legacy layout). */
  static getDownloadedTrackDirs(): Directory[] {
    return listDownloadDirs('audio');
  }

  /**
   * Per-server artwork for offline downloads. Deliberately excludes the shared artwork dir,
   * which also holds cover art extracted from imported files and cannot be re-downloaded.
   */
  static getDownloadedArtworkDirs(): Directory[] {
    return listDownloadDirs('artwork').filter((dir) => dir.uri !== ARTWORK_CACHE_DIR.uri);
  }

  static getStorageUsage(): StorageUsage {
    const downloadedTracks = this.getDownloadedTrackDirs().reduce((sum, dir) => sum + dirSize(dir), 0);
    const downloadedArtwork = this.getDownloadedArtworkDirs().reduce((sum, dir) => sum + dirSize(dir), 0);
    const importedMusic = dirSize(MUSIC_DIR) + dirSize(ARTWORK_CACHE_DIR);
    const settings = dirSize(SETTINGS_DIR);
    return {
      downloadedTracks,
      downloadedArtwork,
      importedMusic,
      settings,
      total: downloadedTracks + downloadedArtwork + importedMusic + settings,
    };
  }

  static clearDownloadedTracks(): void {
    for (const dir of this.getDownloadedTrackDirs()) {
      try {
        removeDir(dir);
      } catch (error) {
        console.error('Error removing downloaded tracks:', error);
      }
    }
  }

  static clearCachedArtwork(): void {
    for (const dir of this.getDownloadedArtworkDirs()) {
      try {
        removeDir(dir);
      } catch (error) {
        console.error('Error removing cached artwork:', error);
      }
    }
  }

  static ensureStructure(configId?: string): void {
    ensureDir(MUSIC_DIR);
    ensureDir(SETTINGS_DIR);
    if (configId) {
      ensureDir(this.getAudioCacheDir(configId));
      ensureDir(this.getArtworkCacheDir(configId));
    } else {
      ensureDir(AUDIO_CACHE_DIR);
      ensureDir(ARTWORK_CACHE_DIR);
    }
  }

  static readJson<T>(fileName: string): T | null {
    ensureDir(SETTINGS_DIR);
    const file = new File(SETTINGS_DIR, fileName);
    if (!file.exists) return null;
    try {
      return JSON.parse(file.textSync()) as T;
    } catch (error) {
      console.error(`Error reading settings file ${fileName}:`, error);
      return null;
    }
  }

  static writeJson(fileName: string, data: unknown): void {
    ensureDir(SETTINGS_DIR);
    const file = new File(SETTINGS_DIR, fileName);
    file.write(JSON.stringify(data, null, 2));
  }

  static removeJson(fileName: string): void {
    const file = new File(SETTINGS_DIR, fileName);
    if (file.exists) {
      try {
        file.delete();
      } catch (error) {
        console.error(`Error removing settings file ${fileName}:`, error);
      }
    }
  }

  static migrateLegacyCache(): boolean {
    const audioMoved = moveFilesFrom(LEGACY_AUDIO_CACHE_DIR, AUDIO_CACHE_DIR);
    const artworkMoved = moveFilesFrom(LEGACY_ARTWORK_CACHE_DIR, ARTWORK_CACHE_DIR);
    return audioMoved || artworkMoved;
  }

  static migrateImportedFiles(): Map<string, string> {
    const uriMap = new Map<string, string>();
    if (!Paths.document.exists) return uriMap;

    ensureDir(MUSIC_DIR);
    ensureDir(ARTWORK_CACHE_DIR);

    for (const entry of Paths.document.list()) {
      if (!(entry instanceof File)) continue;
      const ext = entry.extension.replace('.', '').toLowerCase();
      const oldUri = entry.uri;
      try {
        if (AUDIO_EXTENSIONS.includes(ext)) {
          entry.move(MUSIC_DIR);
          uriMap.set(oldUri, entry.uri);
        } else if (entry.name.replace(/\.\w+$/, '').endsWith('_artwork')) {
          entry.move(ARTWORK_CACHE_DIR);
          uriMap.set(oldUri, entry.uri);
        }
      } catch (error) {
        console.error(`Error migrating file ${oldUri}:`, error);
      }
    }
    return uriMap;
  }
}
