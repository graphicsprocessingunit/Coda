import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import { TrackMetadata } from '../context/AudioContext';

export interface PickedFile {
  uri: string;
  name: string;
  size: number;
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
        const destFile = new File(Paths.document, asset.name);
        if (!destFile.exists) {
          const sourceFile = new File(asset.uri);
          sourceFile.copy(destFile);
        }
        return {
          uri: destFile.uri,
          name: asset.name,
          size: asset.size || 0,
        };
      });

      return files;
    } catch (error) {
      console.error('Error picking files:', error);
      return [];
    }
  }

  static filesToTracks(files: PickedFile[]): TrackMetadata[] {
    return files.map((file) => ({
      title: file.name.replace(/\.[^/.]+$/, ''),
      artist: 'Unknown Artist',
      uri: file.uri,
    }));
  }
}
