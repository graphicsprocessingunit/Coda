import React, { useState } from 'react';
import { View, StyleSheet, Text, Pressable, Modal, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme, Theme } from '../context/ThemeContext';
import { useAudio } from '../context/AudioContext';
import { SleepTimerSection } from './SleepTimer';
import { AudioEffectsSection } from './AudioEffects';
import { NavidromeSettingsSection } from './NavidromeSettings';

interface SettingsProps {
  onClearData: () => void;
}

export function Settings({ onClearData }: SettingsProps) {
  const { theme, colors, setTheme } = useTheme();
  const { navidromeConnected, crossfadeEnabled, crossfadeDuration, setCrossfadeEnabled, setCrossfadeDuration, seamlessEnabled, setSeamlessEnabled } = useAudio();
  const [showAppearance, setShowAppearance] = useState(false);
  const [showAudioEffects, setShowAudioEffects] = useState(false);
  const [showSleepTimer, setShowSleepTimer] = useState(false);
  const [showCrossfade, setShowCrossfade] = useState(false);
  const [showNavidrome, setShowNavidrome] = useState(false);

  const themes: { key: Theme; name: string; icon: string }[] = [
    { key: 'dark', name: 'Dark', icon: 'moon' },
    { key: 'light', name: 'Light', icon: 'sunny' },
    { key: 'midnight', name: 'Midnight', icon: 'star' },
    { key: 'ocean', name: 'Ocean', icon: 'water' },
  ];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Settings</Text>
      </View>

      <ScrollView style={styles.scrollContent} contentContainerStyle={styles.scrollContentContainer}>
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Preferences</Text>
          <View style={[styles.sectionContent, { backgroundColor: colors.card }]}>
            <Pressable
              style={[styles.settingItem, { borderBottomColor: colors.border }]}
              onPress={() => setShowAppearance(true)}
            >
              <View style={styles.settingLeft}>
                <Ionicons name="color-palette" size={24} color={colors.textSecondary} />
                <Text style={[styles.settingText, { color: colors.text }]}>Appearance</Text>
              </View>
              <Ionicons name="chevron-forward" size={24} color={colors.textSecondary} />
            </Pressable>
            <Pressable
              style={[styles.settingItem, { borderBottomColor: colors.border }]}
              onPress={() => setShowAudioEffects(true)}
            >
              <View style={styles.settingLeft}>
                <Ionicons name="options" size={24} color={colors.textSecondary} />
                <Text style={[styles.settingText, { color: colors.text }]}>Audio Effects</Text>
              </View>
              <Ionicons name="chevron-forward" size={24} color={colors.textSecondary} />
            </Pressable>
            <Pressable
              style={[styles.settingItem, { borderBottomColor: colors.border }]}
              onPress={() => setShowSleepTimer(true)}
            >
              <View style={styles.settingLeft}>
                <Ionicons name="moon" size={24} color={colors.textSecondary} />
                <Text style={[styles.settingText, { color: colors.text }]}>Sleep Timer</Text>
              </View>
              <Ionicons name="chevron-forward" size={24} color={colors.textSecondary} />
            </Pressable>
            <Pressable
              style={styles.settingItem}
              onPress={() => setShowCrossfade(true)}
            >
              <View style={styles.settingLeft}>
                <Ionicons name="swap-horizontal" size={24} color={colors.textSecondary} />
                <Text style={[styles.settingText, { color: colors.text }]}>Crossfade</Text>
              </View>
              <View style={styles.settingRight}>
                {seamlessEnabled ? (
                  <Text style={[styles.settingValue, { color: colors.accent }]}>Seamless</Text>
                ) : crossfadeEnabled ? (
                  <Text style={[styles.settingValue, { color: colors.accent }]}>{crossfadeDuration}s</Text>
                ) : null}
                <Ionicons name="chevron-forward" size={24} color={colors.textSecondary} />
              </View>
            </Pressable>
            <Pressable
              style={styles.settingItem}
              onPress={() => setShowNavidrome(true)}
            >
              <View style={styles.settingLeft}>
                <Ionicons name="server-outline" size={24} color={navidromeConnected ? '#34C759' : colors.textSecondary} />
                <Text style={[styles.settingText, { color: colors.text }]}>Navidrome</Text>
              </View>
              <View style={styles.settingRight}>
                {navidromeConnected && (
                  <View style={[styles.statusDot, { backgroundColor: '#34C759' }]} />
                )}
                <Ionicons name="chevron-forward" size={24} color={colors.textSecondary} />
              </View>
            </Pressable>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Data</Text>
          <View style={[styles.sectionContent, { backgroundColor: colors.card }]}>
            <Pressable
              style={styles.settingItem}
              onPress={onClearData}
            >
              <View style={styles.settingLeft}>
                <Ionicons name="trash" size={24} color="#FF3B30" />
                <Text style={[styles.settingText, { color: '#FF3B30' }]}>Clear All Data</Text>
              </View>
              <Ionicons name="chevron-forward" size={24} color={colors.textSecondary} />
            </Pressable>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>About</Text>
          <View style={[styles.sectionContent, { backgroundColor: colors.card }]}>
            <View style={[styles.settingItem, { borderBottomColor: colors.border }]}>
              <View style={styles.settingLeft}>
                <Ionicons name="information-circle" size={24} color={colors.textSecondary} />
                <Text style={[styles.settingText, { color: colors.text }]}>Version</Text>
              </View>
              <Text style={[styles.settingValue, { color: colors.textSecondary }]}>1.0.0</Text>
            </View>
            <View style={styles.settingItem}>
              <View style={styles.settingLeft}>
                <Ionicons name="musical-notes" size={24} color={colors.textSecondary} />
                <Text style={[styles.settingText, { color: colors.text }]}>Coda Music Player</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.bottomPadding} />
      </ScrollView>

      <Modal
        visible={showAppearance}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowAppearance(false)}
      >
        <View style={modalStyles.overlay}>
          <View style={[modalStyles.content, { backgroundColor: colors.background }]}>
            <View style={[modalStyles.header, { borderBottomColor: colors.border }]}>
              <Text style={[modalStyles.title, { color: colors.text }]}>Appearance</Text>
              <Pressable onPress={() => setShowAppearance(false)} hitSlop={10}>
                <Ionicons name="close" size={28} color={colors.textSecondary} />
              </Pressable>
            </View>
            <View style={modalStyles.body}>
              {themes.map((t) => (
                <Pressable
                  key={t.key}
                  style={[modalStyles.themeRow, { borderBottomColor: colors.border }]}
                  onPress={() => setTheme(t.key)}
                >
                  <View style={modalStyles.themeLeft}>
                    <Ionicons name={t.icon as any} size={24} color={colors.textSecondary} />
                    <Text style={[modalStyles.themeName, { color: colors.text }]}>{t.name}</Text>
                  </View>
                  {theme === t.key && (
                    <Ionicons name="checkmark-circle" size={24} color={colors.accent} />
                  )}
                </Pressable>
              ))}
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showAudioEffects}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowAudioEffects(false)}
      >
        <View style={modalStyles.overlay}>
          <View style={[modalStyles.content, { backgroundColor: colors.background }]}>
            <View style={[modalStyles.header, { borderBottomColor: colors.border }]}>
              <Text style={[modalStyles.title, { color: colors.text }]}>Audio Effects</Text>
              <Pressable onPress={() => setShowAudioEffects(false)} hitSlop={10}>
                <Ionicons name="close" size={28} color={colors.textSecondary} />
              </Pressable>
            </View>
            <AudioEffectsSection />
          </View>
        </View>
      </Modal>

      <Modal
        visible={showSleepTimer}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowSleepTimer(false)}
      >
        <View style={modalStyles.overlay}>
          <View style={[modalStyles.content, { backgroundColor: colors.background }]}>
            <View style={[modalStyles.header, { borderBottomColor: colors.border }]}>
              <Text style={[modalStyles.title, { color: colors.text }]}>Sleep Timer</Text>
              <Pressable onPress={() => setShowSleepTimer(false)} hitSlop={10}>
                <Ionicons name="close" size={28} color={colors.textSecondary} />
              </Pressable>
            </View>
            <SleepTimerSection />
          </View>
        </View>
      </Modal>

      <Modal
        visible={showCrossfade}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowCrossfade(false)}
      >
        <View style={modalStyles.overlay}>
          <View style={[modalStyles.content, { backgroundColor: colors.background }]}>
            <View style={[modalStyles.header, { borderBottomColor: colors.border }]}>
              <Text style={[modalStyles.title, { color: colors.text }]}>Crossfade</Text>
              <Pressable onPress={() => setShowCrossfade(false)} hitSlop={10}>
                <Ionicons name="close" size={28} color={colors.textSecondary} />
              </Pressable>
            </View>
            <View style={{ padding: 20 }}>
              <Pressable
                style={[modalStyles.themeRow, { borderBottomColor: colors.border }]}
                onPress={() => setCrossfadeEnabled(!crossfadeEnabled)}
              >
                <View style={modalStyles.themeLeft}>
                  <Ionicons name="swap-horizontal" size={24} color={colors.textSecondary} />
                  <Text style={[modalStyles.themeName, { color: colors.text }]}>Enable Crossfade</Text>
                </View>
                <View style={[styles.toggleTrack, { backgroundColor: crossfadeEnabled ? colors.accent : colors.border }]}>
                  <View style={[styles.toggleThumb, { transform: [{ translateX: crossfadeEnabled ? 20 : 0 }], backgroundColor: '#FFFFFF' }]} />
                </View>
              </Pressable>
              <Pressable
                style={[modalStyles.themeRow, { borderBottomColor: colors.border }]}
                onPress={() => setSeamlessEnabled(!seamlessEnabled)}
              >
                <View style={modalStyles.themeLeft}>
                  <Ionicons name="flash" size={24} color={colors.textSecondary} />
                  <View>
                    <Text style={[modalStyles.themeName, { color: colors.text }]}>Seamless</Text>
                    <Text style={{ color: colors.textSecondary, fontSize: 12 }}>No gaps between tracks</Text>
                  </View>
                </View>
                <View style={[styles.toggleTrack, { backgroundColor: seamlessEnabled ? colors.accent : colors.border }]}>
                  <View style={[styles.toggleThumb, { transform: [{ translateX: seamlessEnabled ? 20 : 0 }], backgroundColor: '#FFFFFF' }]} />
                </View>
              </Pressable>
              {crossfadeEnabled && !seamlessEnabled && (
                <View style={{ marginTop: 16 }}>
                  <Text style={{ color: colors.textSecondary, fontSize: 14, marginBottom: 12 }}>Duration</Text>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    {[2, 4, 6, 8].map((secs) => (
                      <Pressable
                        key={secs}
                        style={[
                          modalStyles.durationChip,
                          {
                            backgroundColor: crossfadeDuration === secs ? colors.accent : colors.card,
                            borderColor: crossfadeDuration === secs ? colors.accent : colors.border,
                          },
                        ]}
                        onPress={() => setCrossfadeDuration(secs)}
                      >
                        <Text style={{ color: crossfadeDuration === secs ? '#FFFFFF' : colors.text, fontWeight: '600' }}>
                          {secs}s
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              )}
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showNavidrome}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowNavidrome(false)}
      >
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={modalStyles.overlay}>
            <View style={[modalStyles.content, { backgroundColor: colors.background }]}>
              <View style={[modalStyles.header, { borderBottomColor: colors.border }]}>
                <Text style={[modalStyles.title, { color: colors.text }]}>Navidrome</Text>
                <Pressable onPress={() => setShowNavidrome(false)} hitSlop={10}>
                  <Ionicons name="close" size={28} color={colors.textSecondary} />
                </Pressable>
              </View>
              <ScrollView
                contentContainerStyle={{ paddingBottom: 40 }}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="on-drag"
              >
                <NavidromeSettingsSection />
              </ScrollView>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: '700',
  },
  scrollContent: {
    flex: 1,
  },
  scrollContentContainer: {
    paddingBottom: 20,
  },
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
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  settingText: {
    fontSize: 16,
    fontWeight: '500',
  },
  settingValue: {
    fontSize: 16,
  },
  settingRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  bottomPadding: {
    height: 40,
  },
  toggleTrack: {
    width: 51,
    height: 31,
    borderRadius: 16,
    padding: 2,
  },
  toggleThumb: {
    width: 27,
    height: 27,
    borderRadius: 14,
  },
});

const modalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  content: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '92%',
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
  },
  body: {
    marginHorizontal: 20,
    marginTop: 12,
    borderRadius: 12,
  },
  themeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  themeLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  themeName: {
    fontSize: 16,
    fontWeight: '500',
  },
  durationChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 56,
  },
});
