import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, StyleSheet, Text, Pressable, Modal, ScrollView, KeyboardAvoidingView, Platform, TextInput, Alert, Linking, ActivityIndicator, InteractionManager } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme, Theme } from '../context/ThemeContext';
import { useAudio } from '../context/AudioContext';
import { SleepTimerSection } from './SleepTimer';
import { AudioEffectsSection } from './AudioEffects';
import { NavidromeSettingsSection } from './NavidromeSettings';
import { AppStorageService, StorageUsage } from '../services/AppStorageService';
import { LastFmService } from '../services/LastFmService';
import { useSyncedLyricsEnabled } from '../hooks/useSyncedLyricsEnabled';
import { setSyncedLyricsEnabled } from '../services/LyricsSettings';

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB'];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[unit]}`;
}

const EMPTY_USAGE: StorageUsage = {
  downloadedTracks: 0,
  downloadedArtwork: 0,
  importedMusic: 0,
  settings: 0,
  total: 0,
};

interface SettingsProps {
  onClearData: () => void;
}

export function Settings({ onClearData }: SettingsProps) {
  const { theme, colors, setTheme, layout, setLayout } = useTheme();
  const { navidromeConnected, crossfadeEnabled, crossfadeDuration, setCrossfadeEnabled, setCrossfadeDuration, seamlessEnabled, setSeamlessEnabled, lastFmConnected, connectLastFm, disconnectLastFm, loadSavedLastFmLogin, clearDownloadedTracks, clearCachedArtwork } = useAudio();
  const syncedLyricsEnabled = useSyncedLyricsEnabled();
  const [showAppearance, setShowAppearance] = useState(false);
  const [showAudioEffects, setShowAudioEffects] = useState(false);
  const [showSleepTimer, setShowSleepTimer] = useState(false);
  const [showCrossfade, setShowCrossfade] = useState(false);
  const [showNavidrome, setShowNavidrome] = useState(false);
  const [showLastFm, setShowLastFm] = useState(false);
  const [lastFmApiKey, setLastFmApiKey] = useState('');
  const [lastFmSharedSecret, setLastFmSharedSecret] = useState('');
  const [lastFmToken, setLastFmToken] = useState('');
  const [lastFmLoading, setLastFmLoading] = useState(false);
  const [lastFmError, setLastFmError] = useState('');
  const [showStorage, setShowStorage] = useState(false);
  const [usage, setUsage] = useState<StorageUsage>(EMPTY_USAGE);
  const [usageLoading, setUsageLoading] = useState(true);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const refreshUsage = useCallback(() => {
    setUsageLoading(true);
    const task = InteractionManager.runAfterInteractions(() => {
      AppStorageService.measureStorageUsage((partial) => {
        if (mountedRef.current) setUsage(partial);
      })
        .then((final) => {
          if (!mountedRef.current) return;
          setUsage(final);
          setUsageLoading(false);
        })
        .catch(() => {
          if (mountedRef.current) setUsageLoading(false);
        });
    });
    return () => task.cancel();
  }, []);

  useEffect(() => refreshUsage(), [refreshUsage]);

  useEffect(() => {
    loadSavedLastFmLogin().then((saved) => {
      if (saved) {
        setLastFmApiKey(saved.apiKey);
        setLastFmSharedSecret(saved.sharedSecret);
      }
    });
  }, [loadSavedLastFmLogin]);

  const confirmClearStorage = (
    title: string,
    message: string,
    confirmLabel: string,
    action: () => void,
  ) => {
    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: confirmLabel,
        style: 'destructive',
        onPress: () => {
          action();
          refreshUsage();
        },
      },
    ]);
  };

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
              style={[styles.settingItem, { borderBottomColor: colors.border }]}
              onPress={() => {
                void setSyncedLyricsEnabled(!syncedLyricsEnabled);
              }}
              accessibilityRole="switch"
              accessibilityState={{ checked: syncedLyricsEnabled }}
              accessibilityLabel="Synced lyrics"
              accessibilityHint="Highlight lyrics in time with the music"
            >
              <View style={styles.settingLeft}>
                <Ionicons name="mic-outline" size={24} color={colors.textSecondary} />
                <View style={{ flexShrink: 1 }}>
                  <Text style={[styles.settingText, { color: colors.text }]}>Synced lyrics</Text>
                  <Text style={[styles.settingSubtext, { color: colors.textSecondary }]}>
                    Highlight lyrics in time with the music
                  </Text>
                </View>
              </View>
              <View
                style={[
                  styles.toggleTrack,
                  { backgroundColor: syncedLyricsEnabled ? colors.accent : colors.border },
                ]}
              >
                <View
                  style={[
                    styles.toggleThumb,
                    {
                      transform: [{ translateX: syncedLyricsEnabled ? 20 : 0 }],
                      backgroundColor: '#FFFFFF',
                    },
                  ]}
                />
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
            <Pressable
              style={styles.settingItem}
              onPress={() => setShowLastFm(true)}
            >
              <View style={styles.settingLeft}>
                <Ionicons name="musical-note" size={24} color={lastFmConnected ? '#E81B23' : colors.textSecondary} />
                <Text style={[styles.settingText, { color: colors.text }]}>Last.fm</Text>
              </View>
              <View style={styles.settingRight}>
                {lastFmConnected && (
                  <View style={[styles.statusDot, { backgroundColor: '#E81B23' }]} />
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
              style={[styles.settingItem, { borderBottomColor: colors.border }]}
              onPress={() => {
                refreshUsage();
                setShowStorage(true);
              }}
            >
              <View style={styles.settingLeft}>
                <Ionicons name="folder-outline" size={24} color={colors.textSecondary} />
                <View>
                  <Text style={[styles.settingText, { color: colors.text }]}>Storage</Text>
                  <Text style={[styles.settingSubtext, { color: colors.textSecondary }]}>
                    {usageLoading ? 'Calculating…' : `${formatSize(usage.total)} used`}
                  </Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={24} color={colors.textSecondary} />
            </Pressable>
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
              <Text style={[styles.settingValue, { color: colors.textSecondary }]}>1.5.0</Text>
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
              <Pressable
                style={[modalStyles.themeRow, { borderBottomColor: colors.border }]}
                onPress={() => setLayout('standard')}
              >
                <View style={modalStyles.themeLeft}>
                  <Ionicons name="albums" size={24} color={colors.textSecondary} />
                  <Text style={[modalStyles.themeName, { color: colors.text }]}>Layout: Standard</Text>
                </View>
                {layout === 'standard' && <Ionicons name="checkmark-circle" size={24} color={colors.accent} />}
              </Pressable>
              <Pressable
                style={[modalStyles.themeRow, { borderBottomColor: colors.border }]}
                onPress={() => setLayout('ipod')}
              >
                <View style={modalStyles.themeLeft}>
                  <Ionicons name="disc" size={24} color={colors.textSecondary} />
                  <Text style={[modalStyles.themeName, { color: colors.text }]}>Layout: iPod Classic</Text>
                </View>
                {layout === 'ipod' && <Ionicons name="checkmark-circle" size={24} color={colors.accent} />}
              </Pressable>
              <Text style={[modalStyles.sectionNote, { color: colors.textSecondary }]}>Theme</Text>
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
        visible={showStorage}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowStorage(false)}
      >
        <View style={modalStyles.overlay}>
          <View style={[modalStyles.content, { backgroundColor: colors.background }]}>
            <View style={[modalStyles.header, { borderBottomColor: colors.border }]}>
              <Text style={[modalStyles.title, { color: colors.text }]}>Storage</Text>
              <Pressable onPress={() => setShowStorage(false)} hitSlop={10}>
                <Ionicons name="close" size={28} color={colors.textSecondary} />
              </Pressable>
            </View>
            <View style={{ paddingHorizontal: 20, paddingTop: 12 }}>
              <View style={[styles.storageCard, { backgroundColor: colors.card }]}>
                {[
                  { label: 'Downloaded tracks', size: usage.downloadedTracks, icon: 'cloud-download-outline' },
                  { label: 'Downloaded artwork', size: usage.downloadedArtwork, icon: 'image-outline' },
                  { label: 'Imported music & art', size: usage.importedMusic, icon: 'musical-notes-outline' },
                  { label: 'Server settings', size: usage.settings, icon: 'document-text-outline' },
                ].map((row, index, rows) => (
                  <View
                    key={row.label}
                    style={[
                      modalStyles.themeRow,
                      { borderBottomColor: colors.border },
                      index === rows.length - 1 && { borderBottomWidth: 0 },
                    ]}
                  >
                    <View style={modalStyles.themeLeft}>
                      <Ionicons name={row.icon as any} size={22} color={colors.textSecondary} />
                      <Text style={[modalStyles.themeName, { color: colors.text }]}>{row.label}</Text>
                    </View>
                    <Text style={[styles.settingValue, { color: colors.textSecondary }]}>
                      {usageLoading ? '…' : formatSize(row.size)}
                    </Text>
                  </View>
                ))}
              </View>
              <Text style={[styles.settingSubtext, { color: colors.textSecondary, marginTop: 10 }]}>
                {usageLoading
                  ? 'Calculating…'
                  : `Total ${formatSize(usage.total)} · Files → On My iPhone → Coda`}
              </Text>

              <Pressable
                style={[
                  modalStyles.themeRow,
                  { borderBottomColor: colors.border, marginTop: 16 },
                  (usageLoading || usage.downloadedTracks === 0) && { opacity: 0.4 },
                ]}
                disabled={usageLoading || usage.downloadedTracks === 0}
                onPress={() =>
                  confirmClearStorage(
                    'Remove downloads',
                    'Offline tracks will be deleted. They stream from your server again the next time you play them.',
                    'Remove',
                    clearDownloadedTracks,
                  )
                }
              >
                <View style={modalStyles.themeLeft}>
                  <Ionicons name="cloud-offline-outline" size={22} color={colors.danger} />
                  <View style={{ flex: 1 }}>
                    <Text style={[modalStyles.themeName, { color: colors.danger }]}>Remove downloads</Text>
                    <Text style={[styles.settingSubtext, { color: colors.textSecondary }]}>
                      {usageLoading
                        ? 'Calculating…'
                        : `Frees ${formatSize(usage.downloadedTracks)}; playback falls back to streaming`}
                    </Text>
                  </View>
                </View>
              </Pressable>

              <Pressable
                style={[modalStyles.themeRow, { borderBottomColor: colors.border }, (usageLoading || usage.downloadedArtwork === 0) && { opacity: 0.4 }]}
                disabled={usageLoading || usage.downloadedArtwork === 0}
                onPress={() =>
                  confirmClearStorage(
                    'Clear cached artwork',
                    'Cached cover art from your server will be deleted and re-downloaded when needed.',
                    'Clear',
                    clearCachedArtwork,
                  )
                }
              >
                <View style={modalStyles.themeLeft}>
                  <Ionicons name="image-outline" size={22} color={colors.danger} />
                  <View style={{ flex: 1 }}>
                    <Text style={[modalStyles.themeName, { color: colors.danger }]}>Clear cached artwork</Text>
                    <Text style={[styles.settingSubtext, { color: colors.textSecondary }]}>
                      {usageLoading
                        ? 'Calculating…'
                        : `Frees ${formatSize(usage.downloadedArtwork)}; imported cover art is kept`}
                    </Text>
                  </View>
                </View>
              </Pressable>
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

      <Modal
        visible={showLastFm}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowLastFm(false)}
      >
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={modalStyles.overlay}>
            <View style={[modalStyles.content, { backgroundColor: colors.background }]}>
              <View style={[modalStyles.header, { borderBottomColor: colors.border }]}>
                <Text style={[modalStyles.title, { color: colors.text }]}>Last.fm</Text>
                <Pressable onPress={() => setShowLastFm(false)} hitSlop={10}>
                  <Ionicons name="close" size={28} color={colors.textSecondary} />
                </Pressable>
              </View>
              <ScrollView
                contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="on-drag"
              >
                {lastFmConnected ? (
                  <View>
                    <View style={[modalStyles.themeRow, { borderBottomColor: colors.border }]}>
                      <View style={modalStyles.themeLeft}>
                        <Ionicons name="checkmark-circle" size={24} color="#E81B23" />
                        <View>
                          <Text style={[modalStyles.themeName, { color: colors.text }]}>Connected to Last.fm</Text>
                          <Text style={{ color: colors.textSecondary, fontSize: 13, marginTop: 2 }}>Scrobbling active</Text>
                        </View>
                      </View>
                    </View>
                    <Pressable
                      style={[modalStyles.themeRow, { borderBottomColor: colors.border }]}
                      onPress={() => {
                        Alert.alert(
                          'Disconnect Last.fm',
                          'Are you sure you want to disconnect from Last.fm?',
                          [
                            { text: 'Cancel', style: 'cancel' },
                            {
                              text: 'Disconnect',
                              style: 'destructive',
                              onPress: () => {
                                disconnectLastFm();
                                setLastFmApiKey('');
                                setLastFmSharedSecret('');
                                setLastFmToken('');
                              },
                            },
                          ]
                        );
                      }}
                    >
                      <View style={modalStyles.themeLeft}>
                        <Ionicons name="log-out-outline" size={24} color="#FF3B30" />
                        <Text style={[modalStyles.themeName, { color: '#FF3B30' }]}>Disconnect</Text>
                      </View>
                    </Pressable>
                  </View>
                ) : (
                  <View>
                    <Text style={{ color: colors.textSecondary, fontSize: 14, marginBottom: 16 }}>
                      Scrobble your listening history to Last.fm
                    </Text>
                    <Pressable
                      onPress={() => Linking.openURL('https://www.last.fm/api/account/create')}
                      style={{ marginBottom: 16 }}
                    >
                      <Text style={{ color: colors.accent, fontSize: 14 }}>Register an API key →</Text>
                    </Pressable>
                    <TextInput
                      style={[styles.lastFmInput, { color: colors.text, borderColor: colors.border }]}
                      placeholder="API Key"
                      placeholderTextColor={colors.textSecondary}
                      value={lastFmApiKey}
                      onChangeText={setLastFmApiKey}
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                    <TextInput
                      style={[styles.lastFmInput, { color: colors.text, borderColor: colors.border }]}
                      placeholder="Shared Secret"
                      placeholderTextColor={colors.textSecondary}
                      value={lastFmSharedSecret}
                      onChangeText={setLastFmSharedSecret}
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                    <Text style={{ color: colors.textSecondary, fontSize: 12, marginBottom: 8 }}>
                      1. Tap &apos;Authorize App&apos; below{'\n'}2. Copy the token from the browser{'\n'}3. Paste it here
                    </Text>
                    <TextInput
                      style={[styles.lastFmInput, { color: colors.text, borderColor: colors.border }]}
                      placeholder="Token"
                      placeholderTextColor={colors.textSecondary}
                      value={lastFmToken}
                      onChangeText={setLastFmToken}
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                    {lastFmApiKey.trim() ? (
                      <Pressable
                        style={[styles.lastFmButton, { backgroundColor: colors.card, borderColor: colors.border }]}
                        onPress={() => Linking.openURL(LastFmService.getAuthUrl(lastFmApiKey.trim()))}
                      >
                        <Text style={{ color: colors.text, fontSize: 16, fontWeight: '600' }}>Authorize App</Text>
                      </Pressable>
                    ) : null}
                    {lastFmError ? (
                      <View style={[styles.lastFmError, { backgroundColor: '#FF3B30' + '15' }]}>
                        <Ionicons name="alert-circle" size={18} color="#FF3B30" />
                        <Text style={{ color: '#FF3B30', fontSize: 14, flex: 1 }}>{lastFmError}</Text>
                      </View>
                    ) : null}
                    <Pressable
                      style={[
                        styles.lastFmButton,
                        { backgroundColor: colors.accent },
                        lastFmLoading && { opacity: 0.6 },
                      ]}
                      onPress={async () => {
                        if (!lastFmApiKey.trim() || !lastFmSharedSecret.trim() || !lastFmToken.trim()) {
                          setLastFmError('All fields are required');
                          return;
                        }
                        setLastFmLoading(true);
                        setLastFmError('');
                        const result = await connectLastFm(
                          lastFmApiKey.trim(),
                          lastFmSharedSecret.trim(),
                          lastFmToken.trim()
                        );
                        setLastFmLoading(false);
                        if (!result.ok) {
                          setLastFmError(result.error || 'Connection failed');
                        } else {
                          setLastFmApiKey('');
                          setLastFmSharedSecret('');
                          setLastFmToken('');
                        }
                      }}
                      disabled={lastFmLoading}
                    >
                      {lastFmLoading ? (
                        <ActivityIndicator color="#fff" size="small" />
                      ) : (
                        <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>Connect</Text>
                      )}
                    </Pressable>
                  </View>
                )}
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
  settingSubtext: {
    fontSize: 12,
    marginTop: 2,
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
  lastFmInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 15,
    marginBottom: 10,
  },
  lastFmButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 10,
    marginTop: 4,
  },
  storageCard: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  lastFmError: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    marginBottom: 10,
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
  sectionNote: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 12,
    marginLeft: 2,
    marginBottom: 2,
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
