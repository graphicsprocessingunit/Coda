import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { getAudioMetadata } from '@missingcore/audio-metadata';
import { AppStorageService } from './AppStorageService';
import { TrackMetadata } from '../context/AudioContext';

export interface PickedFile {
  uri: string;
  name: string;
  size: number;
}

function sanitizeFileName(name: string): string {
  return name
    .replace(/[/\\]/g, '')
    .replace(/\.\./g, '')
    .replace(/\0/g, '')
    .trim();
}

function base64ToArtworkFile(base64Data: string, fileName: string): string {
  const match = base64Data.match(/^data:image\/\w+;base64,(.+)$/);
  if (!match) return '';

  const base64 = match[1];
  const ext = base64Data.match(/^data:image\/(\w+);/)?.[1] || 'jpg';
  const artFileName = `${sanitizeFileName(fileName.replace(/\.[^/.]+$/, ''))}_artwork.${ext}`;
  AppStorageService.ensureStructure();
  const artFile = new File(AppStorageService.artworkCacheDir, artFileName);

  if (artFile.exists) {
    return artFile.uri;
  }

  const raw = atob(base64);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) {
    bytes[i] = raw.charCodeAt(i);
  }
  artFile.write(bytes);
  return artFile.uri;
}

export class FilePickerService {
  static async pickAudioFiles(): Promise<PickedFile[]> {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['audio/*'],
        multiple: true,
        copyToCacheDirectory: true,
      });

      if (result.canceled) {
        return [];
      }

      const files: PickedFile[] = result.assets.map((asset) => {
        const safeName = sanitizeFileName(asset.name);
        AppStorageService.ensureStructure();
        const destFile = new File(AppStorageService.musicDir, safeName);
        if (!destFile.exists) {
          const sourceFile = new File(asset.uri);
          sourceFile.copy(destFile);
        }
        return {
          uri: destFile.uri,
          name: safeName,
          size: asset.size || 0,
        };
      });

      return files;
    } catch (error) {
      console.error('Error picking files:', error);
      return [];
    }
  }

  static async filesToTracks(files: PickedFile[]): Promise<TrackMetadata[]> {
    const tracks: TrackMetadata[] = [];

    for (const file of files) {
      const fallbackTitle = file.name.replace(/\.[^/.]+$/, '');
      let title = fallbackTitle;
      let artist = 'Unknown Artist';
      let album: string | undefined;
      let artwork: string | undefined;

      try {
        const data = await getAudioMetadata(file.uri, ['name', 'artist', 'album', 'artwork']);
        const meta = data?.metadata;
        if (meta?.name) title = meta.name;
        if (meta?.artist) artist = meta.artist;
        if (meta?.album) album = meta.album;
        if (meta?.artwork) {
          artwork = base64ToArtworkFile(meta.artwork, file.name) || undefined;
        }
      } catch {
        // Metadata extraction failed — use defaults
      }

      tracks.push({
        title,
        artist,
        uri: file.uri,
        album,
        artwork,
      });
    }

    return tracks;
  }
}
