import { File } from 'expo-file-system';
import * as DocumentPicker from 'expo-document-picker';
import { getAudioMetadata } from '@missingcore/audio-metadata';

import { FilePickerService } from '../src/services/FilePickerService';
import { AppStorageService } from '../src/services/AppStorageService';

// The package only ships a React Native `source` entry, so Jest cannot resolve
// it directly; a virtual mock is enough for the import in the service.
jest.mock(
  '@missingcore/audio-metadata',
  () => ({ getAudioMetadata: jest.fn() }),
  { virtual: true }
);

const picker = DocumentPicker.getDocumentAsync as jest.Mock;
const metadata = getAudioMetadata as jest.Mock;
const fs = require('expo-file-system') as any;

function writeSourceFile(uri: string): void {
  const file = new File(uri);
  file.write('audio-bytes');
}

beforeEach(() => {
  fs.__reset();
  picker.mockReset();
  metadata.mockReset();
  metadata.mockResolvedValue({ metadata: {} });
});

describe('FilePickerService.filesToTracks', () => {
  it('uses embedded metadata when present', async () => {
    metadata.mockResolvedValue({
      metadata: {
        name: 'Real Title',
        artist: 'Real Artist',
        album: 'Real Album',
        albumArtist: 'Album Artist',
        year: 1999,
        track: 4,
      },
    });

    const [track] = await FilePickerService.filesToTracks([
      { uri: 'file:///music/fallback.mp3', name: 'fallback.mp3', size: 10 },
    ]);

    expect(track).toMatchObject({
      title: 'Real Title',
      artist: 'Real Artist',
      album: 'Real Album',
      albumArtist: 'Album Artist',
      year: 1999,
      trackNumber: 4,
      uri: 'file:///music/fallback.mp3',
    });
  });

  it('falls back to the filename when metadata extraction fails', async () => {
    metadata.mockRejectedValue(new Error('unsupported codec'));

    const [track] = await FilePickerService.filesToTracks([
      { uri: 'file:///music/My Song.flac', name: 'My Song.flac', size: 10 },
    ]);

    expect(track.title).toBe('My Song');
    expect(track.artist).toBe('Unknown Artist');
    expect(track.album).toBeUndefined();
    expect(track.artwork).toBeUndefined();
  });

  it('falls back when metadata comes back without fields', async () => {
    metadata.mockResolvedValue({ metadata: null });

    const [track] = await FilePickerService.filesToTracks([
      { uri: 'file:///music/untitled', name: 'untitled', size: 0 },
    ]);

    expect(track.title).toBe('untitled');
    expect(track.artist).toBe('Unknown Artist');
  });

  it('ignores empty strings and non-positive year/track numbers', async () => {
    metadata.mockResolvedValue({
      metadata: { name: '', artist: '', year: 0, track: -2 },
    });

    const [track] = await FilePickerService.filesToTracks([
      { uri: 'file:///music/a.mp3', name: 'a.mp3', size: 1 },
    ]);

    expect(track.title).toBe('a');
    expect(track.artist).toBe('Unknown Artist');
    expect(track.year).toBeUndefined();
    expect(track.trackNumber).toBeUndefined();
  });

  it('writes embedded artwork into the artwork cache and reuses it', async () => {
    metadata.mockResolvedValue({
      metadata: { artwork: 'data:image/png;base64,iVBORw0KGgo=' },
    });
    const file = { uri: 'file:///music/song.mp3', name: 'song.mp3', size: 1 };

    const [first] = await FilePickerService.filesToTracks([file]);
    const [second] = await FilePickerService.filesToTracks([file]);

    expect(first.artwork).toContain('/Coda/Downloads/artwork/');
    expect(first.artwork).toMatch(/_artwork\.png$/);
    expect(new File(first.artwork!).exists).toBe(true);
    expect(second.artwork).toBe(first.artwork);
  });

  it('drops artwork that is not a base64 image data URI', async () => {
    metadata.mockResolvedValue({ metadata: { artwork: 'https://example.com/cover.jpg' } });

    const [track] = await FilePickerService.filesToTracks([
      { uri: 'file:///music/song.mp3', name: 'song.mp3', size: 1 },
    ]);

    expect(track.artwork).toBeUndefined();
  });

  it('processes every file even if one has no metadata', async () => {
    metadata
      .mockResolvedValueOnce({ metadata: { name: 'One' } })
      .mockRejectedValueOnce(new Error('bad file'))
      .mockResolvedValueOnce({ metadata: { name: 'Three' } });

    const tracks = await FilePickerService.filesToTracks([
      { uri: 'file:///music/1.mp3', name: '1.mp3', size: 1 },
      { uri: 'file:///music/2.mp3', name: '2.mp3', size: 1 },
      { uri: 'file:///music/3.mp3', name: '3.mp3', size: 1 },
    ]);

    expect(tracks.map((track) => track.title)).toEqual(['One', '2', 'Three']);
  });
});

describe('FilePickerService.pickAudioFiles', () => {
  it('returns an empty list when the picker is cancelled', async () => {
    picker.mockResolvedValue({ canceled: true });

    await expect(FilePickerService.pickAudioFiles()).resolves.toEqual([]);
  });

  it('copies picked files into the music directory', async () => {
    writeSourceFile('file:///mock-cache/picked.mp3');
    picker.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file:///mock-cache/picked.mp3', name: 'picked.mp3', size: 42 }],
    });

    const files = await FilePickerService.pickAudioFiles();

    expect(files).toHaveLength(1);
    expect(files[0].name).toBe('picked.mp3');
    expect(files[0].size).toBe(42);
    expect(files[0].uri).toContain('/Coda/Music/picked.mp3');
    expect(new File(files[0].uri).exists).toBe(true);
  });

  it('sanitizes path traversal and separators out of the filename', async () => {
    writeSourceFile('file:///mock-cache/evil.mp3');
    picker.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file:///mock-cache/evil.mp3', name: '../../evil.mp3', size: 1 }],
    });

    const [file] = await FilePickerService.pickAudioFiles();

    expect(file.name).toBe('evil.mp3');
    expect(file.uri).not.toContain('..');
  });

  it('does not overwrite a file already imported', async () => {
    writeSourceFile('file:///mock-cache/song.mp3');
    const existing = new File(AppStorageService.musicDir, 'song.mp3');
    existing.write('already here');
    picker.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file:///mock-cache/song.mp3', name: 'song.mp3', size: 1 }],
    });

    await FilePickerService.pickAudioFiles();

    await expect(existing.text()).resolves.toBe('already here');
  });

  it('returns an empty list when the picker throws', async () => {
    const error = jest.spyOn(console, 'error').mockImplementation(() => {});
    picker.mockRejectedValue(new Error('picker crashed'));

    await expect(FilePickerService.pickAudioFiles()).resolves.toEqual([]);
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });
});
