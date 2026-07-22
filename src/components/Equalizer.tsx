import React, { useRef, useCallback } from 'react';
import { View, StyleSheet, Text, Pressable, PanResponder, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useAudio, EqPresetName, EQ_PRESETS, EQ_BAND_LABELS } from '../context/AudioContext';

const PRESET_INFO: { key: EqPresetName; label: string; icon: string }[] = [
  { key: 'flat', label: 'Flat', icon: 'remove-outline' },
  { key: 'bass-boost', label: 'Bass', icon: 'volume-low' },
  { key: 'treble', label: 'Treble', icon: 'volume-high' },
  { key: 'vocal', label: 'Vocal', icon: 'mic' },
  { key: 'rock', label: 'Rock', icon: 'musical-notes' },
  { key: 'pop', label: 'Pop', icon: 'radio' },
];

function VerticalSlider({ value, min, max, onValueChange, color }: {
  value: number;
  min: number;
  max: number;
  onValueChange: (val: number) => void;
  color: string;
}) {
  const trackHeight = 140;
  const thumbSize = 20;
  const range = max - min;
  const normalized = (value - min) / range;
  const translateY = (1 - normalized) * (trackHeight - thumbSize);

  const panY = useRef(new Animated.Value(0)).current;
  const startValue = useRef(value);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        startValue.current = value;
        panY.setValue(0);
      },
      onPanResponderMove: (_, gestureState) => {
        const delta = -gestureState.dy;
        const valueDelta = (delta / (trackHeight - thumbSize)) * range;
        const newValue = Math.round(Math.max(min, Math.min(max, startValue.current + valueDelta)));
        onValueChange(newValue);
      },
      onPanResponderRelease: () => {
        panY.setValue(0);
      },
    })
  ).current;

  return (
    <View style={{ height: trackHeight + 30, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ height: trackHeight, width: 4, backgroundColor: color + '30', borderRadius: 2, position: 'relative' }}>
        <View style={{
          position: 'absolute',
          bottom: 0,
          width: 4,
          height: normalized * trackHeight,
          backgroundColor: color,
          borderRadius: 2,
        }} />
      </View>
      <Animated.View
        style={[styles.sliderThumb, {
          backgroundColor: color,
          transform: [{ translateY }],
          position: 'absolute',
        }]}
        {...panResponder.panHandlers}
      />
      <Text style={[styles.sliderValue, { color }]}>{value > 0 ? `+${value}` : value}</Text>
    </View>
  );
}

export function Equalizer() {
  const { colors } = useTheme();
  const { eqEnabled, eqBands, eqPreset, setEqBandGain, setEqPreset, setEqEnabled } = useAudio();

  return (
    <View style={styles.container}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <View style={styles.headerLeft}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Equalizer</Text>
          <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
            {eqPreset ? PRESET_INFO.find(p => p.key === eqPreset)?.label || 'Custom' : 'Custom'}
          </Text>
        </View>
        <Pressable
          style={[styles.toggleButton, { backgroundColor: eqEnabled ? colors.accent : colors.border }]}
          onPress={() => setEqEnabled(!eqEnabled)}
        >
          <Text style={[styles.toggleText, { color: eqEnabled ? '#fff' : colors.textSecondary }]}>
            {eqEnabled ? 'ON' : 'OFF'}
          </Text>
        </Pressable>
      </View>

      <View style={styles.presetsRow}>
        {PRESET_INFO.map((preset) => {
          const isActive = eqPreset === preset.key;
          return (
            <Pressable
              key={preset.key}
              style={[styles.presetChip, {
                backgroundColor: isActive ? colors.accent : colors.background,
                borderColor: isActive ? colors.accent : colors.border,
              }]}
              onPress={() => setEqPreset(preset.key)}
            >
              <Ionicons name={preset.icon as any} size={16} color={isActive ? '#fff' : colors.textSecondary} />
              <Text style={[styles.presetLabel, { color: isActive ? '#fff' : colors.text }]}>
                {preset.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.bandsContainer}>
        {eqBands.map((gain, i) => (
          <View key={i} style={styles.bandColumn}>
            <VerticalSlider
              value={gain}
              min={-12}
              max={12}
              onValueChange={(val) => setEqBandGain(i, val)}
              color={colors.accent}
            />
            <Text style={[styles.bandLabel, { color: colors.textSecondary }]}>{EQ_BAND_LABELS[i]}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  headerLeft: {},
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  headerSubtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  toggleButton: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 14,
  },
  toggleText: {
    fontSize: 13,
    fontWeight: '700',
  },
  presetsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  presetChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  presetLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  bandsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 16,
  },
  bandColumn: {
    alignItems: 'center',
  },
  sliderThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  sliderValue: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 4,
    fontVariant: ['tabular-nums'],
  },
  bandLabel: {
    fontSize: 10,
    fontWeight: '500',
    marginTop: 2,
  },
});
