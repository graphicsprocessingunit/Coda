import React from 'react';
import { View, StyleSheet, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useAudio, AudioPreset } from '../context/AudioContext';

const PRESETS: { key: AudioPreset; label: string; icon: string; description: string }[] = [
  { key: 'flat', label: 'Flat', icon: 'remove-outline', description: 'No effects' },
  { key: 'relaxed', label: 'Relaxed', icon: 'leaf', description: '0.9x, slower pace' },
  { key: 'clear', label: 'Clear', icon: 'mic', description: '85% vol, less loud' },
  { key: 'upbeat', label: 'Upbeat', icon: 'flash', description: '1.1x, faster pace' },
  { key: 'quiet', label: 'Quiet', icon: 'moon', description: 'Low vol, softer' },
];

const SPEED_OPTIONS = [0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0];
const VOLUME_OPTIONS = [0.25, 0.5, 0.75, 1.0];

export function AudioEffectsSection() {
  const { colors } = useTheme();
  const { playbackRate, volume, audioPreset, setPlaybackRate, setVolume, setAudioPreset } = useAudio();

  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Audio Effects</Text>
      <View style={[styles.sectionContent, { backgroundColor: colors.card }]}>
        <View style={[styles.subSection, { borderBottomColor: colors.border }]}>
          <Text style={[styles.subSectionTitle, { color: colors.textSecondary }]}>Presets</Text>
          <View style={styles.presetsGrid}>
            {PRESETS.map((preset) => {
              const isActive = audioPreset === preset.key;
              return (
                <Pressable
                  key={preset.key}
                  style={[
                    styles.presetButton,
                    { backgroundColor: isActive ? colors.accent + '20' : colors.background },
                    isActive && { borderColor: colors.accent },
                  ]}
                  onPress={() => setAudioPreset(preset.key)}
                >
                  <Ionicons
                    name={preset.icon as any}
                    size={22}
                    color={isActive ? colors.accent : colors.textSecondary}
                  />
                  <Text
                    style={[
                      styles.presetLabel,
                      { color: isActive ? colors.accent : colors.text },
                    ]}
                  >
                    {preset.label}
                  </Text>
                  <Text
                    style={[
                      styles.presetDescription,
                      { color: colors.textSecondary },
                    ]}
                  >
                    {preset.description}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={[styles.subSection, { borderBottomColor: colors.border }]}>
          <View style={styles.speedHeader}>
            <Text style={[styles.subSectionTitle, { color: colors.textSecondary }]}>Speed</Text>
            <Text style={[styles.speedValue, { color: colors.text }]}>{playbackRate.toFixed(2)}x</Text>
          </View>
          <View style={styles.optionsRow}>
            {SPEED_OPTIONS.map((speed) => {
              const isActive = playbackRate === speed;
              return (
                <Pressable
                  key={speed}
                  style={[
                    styles.optionChip,
                    { backgroundColor: isActive ? colors.accent : colors.background },
                    { borderColor: isActive ? colors.accent : colors.border },
                  ]}
                  onPress={() => setPlaybackRate(speed)}
                >
                  <Text
                    style={[
                      styles.optionChipText,
                      { color: isActive ? '#fff' : colors.text },
                    ]}
                  >
                    {speed}x
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.subSection}>
          <View style={styles.speedHeader}>
            <Text style={[styles.subSectionTitle, { color: colors.textSecondary }]}>Volume</Text>
            <Text style={[styles.speedValue, { color: colors.text }]}>{Math.round(volume * 100)}%</Text>
          </View>
          <View style={styles.optionsRow}>
            {VOLUME_OPTIONS.map((vol) => {
              const isActive = volume === vol;
              return (
                <Pressable
                  key={vol}
                  style={[
                    styles.optionChip,
                    { backgroundColor: isActive ? colors.accent : colors.background },
                    { borderColor: isActive ? colors.accent : colors.border },
                  ]}
                  onPress={() => setVolume(vol)}
                >
                  <Text
                    style={[
                      styles.optionChipText,
                      { color: isActive ? '#fff' : colors.text },
                    ]}
                  >
                    {Math.round(vol * 100)}%
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginTop: 24,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    textTransform: 'uppercase',
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  sectionContent: {
    borderRadius: 12,
    marginHorizontal: 20,
  },
  subSection: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  subSectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 10,
  },
  presetsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  presetButton: {
    width: '30%',
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: 'transparent',
    gap: 4,
  },
  presetLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  presetDescription: {
    fontSize: 10,
  },
  speedHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  speedValue: {
    fontSize: 14,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  optionsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  optionChip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  optionChipText: {
    fontSize: 13,
    fontWeight: '600',
  },
});
