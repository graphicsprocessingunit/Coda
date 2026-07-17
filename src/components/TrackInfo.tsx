import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Text, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { File } from 'expo-file-system';
import { TrackMetadata } from '../context/AudioContext';

interface TrackInfoProps {
  track: TrackMetadata;
  duration: number;
}

function formatDuration(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFormatFromUri(uri: string): string {
  const ext = uri.split('.').pop()?.toLowerCase() || '';
  const formats: Record<string, string> = {
    mp3: 'MP3',
    m4a: 'M4A',
    m4b: 'M4B',
    aac: 'AAC',
    flac: 'FLAC',
    ogg: 'OGG',
    ogv: 'OGV',
    wav: 'WAV',
    wma: 'WMA',
    opus: 'OPUS',
    caf: 'CAF',
    aiff: 'AIFF',
  };
  return formats[ext] || ext.toUpperCase() || 'Unknown';
}

export function TrackInfo({ track, duration }: TrackInfoProps) {
  const { colors } = useTheme();
  const [fileSize, setFileSize] = useState<number | null>(null);

  useEffect(() => {
    try {
      const file = new File(track.uri);
      if (file.exists) {
        setFileSize(file.size);
      }
    } catch {}
  }, [track.uri]);

  const rows = [
    { label: 'Duration', value: duration > 0 ? formatDuration(duration) : '--' },
    { label: 'Format', value: getFormatFromUri(track.uri) },
    { label: 'File size', value: fileSize != null ? formatFileSize(fileSize) : '--' },
    { label: 'Source', value: track.source === 'navidrome' ? 'Navidrome' : 'Local' },
  ];

  if (track.album) {
    rows.splice(1, 0, { label: 'Album', value: track.album });
  }

  return (
    <View style={styles.container}>
      <View style={styles.artworkContainer}>
        {track.artwork ? (
          <Image source={{ uri: track.artwork }} style={styles.artwork} />
        ) : (
          <View style={[styles.artworkPlaceholder, { backgroundColor: colors.card }]}>
            <Ionicons name="musical-note" size={48} color={colors.textSecondary} />
          </View>
        )}
      </View>

      <Text style={[styles.title, { color: colors.text }]} numberOfLines={2}>
        {track.title}
      </Text>
      <Text style={[styles.artist, { color: colors.textSecondary }]} numberOfLines={1}>
        {track.artist}
      </Text>

      <View style={[styles.divider, { backgroundColor: colors.border }]} />

      <View style={styles.details}>
        {rows.map((row) => (
          <View key={row.label} style={[styles.row, { borderBottomColor: colors.border }]}>
            <Text style={[styles.rowLabel, { color: colors.textSecondary }]}>{row.label}</Text>
            <Text style={[styles.rowValue, { color: colors.text }]} numberOfLines={1}>
              {row.value}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    padding: 20,
  },
  artworkContainer: {
    marginBottom: 20,
  },
  artwork: {
    width: 200,
    height: 200,
    borderRadius: 12,
  },
  artworkPlaceholder: {
    width: 200,
    height: 200,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 4,
  },
  artist: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
  },
  divider: {
    height: 1,
    width: '100%',
    marginBottom: 4,
  },
  details: {
    width: '100%',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowLabel: {
    fontSize: 15,
  },
  rowValue: {
    fontSize: 15,
    fontWeight: '500',
    flex: 1,
    textAlign: 'right',
    marginLeft: 12,
  },
});
