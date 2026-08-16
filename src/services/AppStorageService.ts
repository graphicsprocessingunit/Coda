import { File, Directory, Paths } from 'expo-file-system';

const AUDIO_EXTENSIONS = ['mp3', 'm4a', 'wav', 'flac', 'aac', 'ogg', 'aif', 'aiff', 'opus'];

const AUDIO_CACHE_DIR = new Directory(Paths.document, 'Coda', 'Downloads', 'audio');
const ARTWORK_CACHE_DIR = new Directory(Paths.document, 'Coda', 'Downloads', 'artwork');
const MUSIC_DIR = new Directory(Paths.document, 'Coda', 'Music');
const SETTINGS_DIR = new Directory(Paths.document, 'Coda', 'Settings');

const LEGACY_AUDIO_CACHE_DIR = new Directory(Paths.document, 'cache/navidrome/audio');
const LEGACY_ARTWORK_CACHE_DIR = new Directory(Paths.document, 'cache/navidrome/artwork');

function ensureDir(dir: Directory): void {
  if (!dir.exists) dir.create({ intermediates: true });
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

  static ensureStructure(): void {
    ensureDir(AUDIO_CACHE_DIR);
    ensureDir(ARTWORK_CACHE_DIR);
    ensureDir(MUSIC_DIR);
    ensureDir(SETTINGS_DIR);
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
      if (AUDIO_EXTENSIONS.includes(ext)) {
        entry.move(MUSIC_DIR);
        uriMap.set(oldUri, entry.uri);
      } else if (entry.name.replace(/\.\w+$/, '').endsWith('_artwork')) {
        entry.move(ARTWORK_CACHE_DIR);
        uriMap.set(oldUri, entry.uri);
      }
    }
    return uriMap;
  }
}
