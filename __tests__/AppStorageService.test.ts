import { Directory, File, Paths } from 'expo-file-system';
import { AppStorageService } from '../src/services/AppStorageService';

const fs = require('expo-file-system') as any;

beforeEach(() => {
  fs.__reset();
});

describe('AppStorageService.ensureStructure', () => {
  it('creates the Coda directory tree', () => {
    AppStorageService.ensureStructure();
    expect(AppStorageService.audioCacheDir.exists).toBe(true);
    expect(AppStorageService.artworkCacheDir.exists).toBe(true);
    expect(AppStorageService.musicDir.exists).toBe(true);
    expect(AppStorageService.settingsDir.exists).toBe(true);
  });

  it('is idempotent', () => {
    AppStorageService.ensureStructure();
    expect(() => AppStorageService.ensureStructure()).not.toThrow();
  });
});

describe('AppStorageService settings JSON', () => {
  it('returns null for a missing file', () => {
    expect(AppStorageService.readJson('missing.json')).toBeNull();
  });

  it('round-trips written JSON', () => {
    const data = { url: 'http://example.com', username: 'alice' };
    AppStorageService.writeJson('test-settings.json', data);
    expect(AppStorageService.readJson('test-settings.json')).toEqual(data);
  });

  it('creates the settings dir on write', () => {
    AppStorageService.writeJson('test-settings.json', {});
    expect(AppStorageService.settingsDir.exists).toBe(true);
  });

  it('removes a settings file', () => {
    AppStorageService.writeJson('test-settings.json', {});
    AppStorageService.removeJson('test-settings.json');
    expect(AppStorageService.readJson('test-settings.json')).toBeNull();
  });

  it('returns null when JSON is invalid', () => {
    AppStorageService.ensureStructure();
    const bad = new File(AppStorageService.settingsDir, 'bad.json');
    bad.write('{not valid json');
    expect(AppStorageService.readJson('bad.json')).toBeNull();
  });
});

describe('AppStorageService.migrateLegacyCache', () => {
  it('moves legacy cache files into Coda/Downloads', () => {
    AppStorageService.ensureStructure();
    const legacyAudio = new Directory(Paths.document, 'cache/navidrome/audio');
    legacyAudio.create({ intermediates: true });
    const legacyArt = new Directory(Paths.document, 'cache/navidrome/artwork');
    legacyArt.create({ intermediates: true });
    new File(legacyAudio, 'track1.mp3').write('audio-bytes');
    new File(legacyArt, 'art1.jpg').write('art-bytes');

    const moved = AppStorageService.migrateLegacyCache();

    expect(moved).toBe(true);
    expect(new File(AppStorageService.audioCacheDir, 'track1.mp3').exists).toBe(true);
    expect(new File(AppStorageService.artworkCacheDir, 'art1.jpg').exists).toBe(true);
    expect(new File(legacyAudio, 'track1.mp3').exists).toBe(false);
    expect(legacyAudio.exists).toBe(false);
    expect(legacyArt.exists).toBe(false);
  });

  it('returns false when no legacy cache exists', () => {
    expect(AppStorageService.migrateLegacyCache()).toBe(false);
  });
});

describe('AppStorageService.migrateImportedFiles', () => {
  it('moves root audio files into Coda/Music and artwork into Coda/Downloads/artwork', () => {
    const song = new File(Paths.document, 'My Song.mp3');
    song.write('audio');
    const cover = new File(Paths.document, 'My Song_artwork.jpg');
    cover.write('img');
    const oldSongUri = song.uri;
    const oldCoverUri = cover.uri;

    const uriMap = AppStorageService.migrateImportedFiles();

    const newSongUri = uriMap.get(oldSongUri);
    expect(newSongUri).toBeDefined();
    expect(new File(newSongUri!).exists).toBe(true);
    expect(new File(AppStorageService.musicDir, 'My Song.mp3').exists).toBe(true);

    const newCoverUri = uriMap.get(oldCoverUri);
    expect(newCoverUri).toBeDefined();
    expect(new File(AppStorageService.artworkCacheDir, 'My Song_artwork.jpg').exists).toBe(true);

    expect(song.exists).toBe(false);
    expect(cover.exists).toBe(false);
  });

  it('returns an empty map when nothing to migrate', () => {
    expect(AppStorageService.migrateImportedFiles().size).toBe(0);
  });

  it('does not move files already inside the Coda tree', () => {
    AppStorageService.ensureStructure();
    const already = new File(AppStorageService.musicDir, 'existing.mp3');
    already.write('audio');

    const uriMap = AppStorageService.migrateImportedFiles();

    expect(uriMap.size).toBe(0);
    expect(already.exists).toBe(true);
  });
});
