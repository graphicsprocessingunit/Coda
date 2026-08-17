import React from 'react';
import { View, StyleSheet, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useAudio, useSleepTimer } from '../context/AudioContext';

const TIMER_OPTIONS = [
  { label: '15 min', minutes: 15 },
  { label: '30 min', minutes: 30 },
  { label: '45 min', minutes: 45 },
  { label: '1 hour', minutes: 60 },
  { label: '90 min', minutes: 90 },
  { label: '2 hours', minutes: 120 },
];

function formatTimer(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function SleepTimerSection() {
  const { colors } = useTheme();
  const { setSleepTimer, cancelSleepTimer } = useAudio();
  const { sleepTimerEnd, sleepTimerRemaining } = useSleepTimer();

  const isActive = sleepTimerEnd !== null;

  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Sleep Timer</Text>
      <View style={[styles.sectionContent, { backgroundColor: colors.card }]}>
        {isActive ? (
          <View style={[styles.activeTimer, { borderBottomColor: colors.border }]}>
            <View style={styles.timerInfo}>
              <Ionicons name="moon" size={24} color={colors.accent} />
              <View style={styles.timerTextContainer}>
                <Text style={[styles.timerCountdown, { color: colors.text }]}>
                  {formatTimer(sleepTimerRemaining)}
                </Text>
                <Text style={[styles.timerLabel, { color: colors.textSecondary }]}>remaining</Text>
              </View>
            </View>
            <Pressable
              style={[styles.cancelButton, { backgroundColor: colors.border }]}
              onPress={cancelSleepTimer}
            >
              <Text style={[styles.cancelButtonText, { color: colors.text }]}>Cancel</Text>
            </Pressable>
          </View>
        ) : (
          <View>
            {TIMER_OPTIONS.map((option, index) => (
              <Pressable
                key={option.minutes}
                style={[styles.timerOption, index < TIMER_OPTIONS.length - 1 && { borderBottomColor: colors.border }]}
                onPress={() => setSleepTimer(option.minutes)}
              >
                <View style={styles.timerOptionLeft}>
                  <Ionicons name="time-outline" size={22} color={colors.textSecondary} />
                  <Text style={[styles.timerOptionText, { color: colors.text }]}>{option.label}</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
              </Pressable>
            ))}
          </View>
        )}
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
  activeTimer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  timerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  timerTextContainer: {
    gap: 2,
  },
  timerCountdown: {
    fontSize: 20,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  timerLabel: {
    fontSize: 12,
  },
  cancelButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  timerOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  timerOptionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  timerOptionText: {
    fontSize: 16,
    fontWeight: '500',
  },
});
