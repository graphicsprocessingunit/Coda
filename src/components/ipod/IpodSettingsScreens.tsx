import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, Pressable, View, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '../../context/ThemeContext';
import { useAudio } from '../../context/AudioContext';
import { Equalizer } from '../Equalizer';
import { AudioEffectsSection } from '../AudioEffects';
import { SleepTimerSection } from '../SleepTimer';
import { NavidromeSettingsSection } from '../NavidromeSettings';
import type { SettingsSection } from './menus';

export function IpodEmbedSection({ section }: { section: SettingsSection }) {
  const { colors } = useTheme();

  switch (section) {
    case 'eq':
      return (
        <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.scroll}>
          <Equalizer />
        </ScrollView>
      );
    case 'audiofx':
      return (
        <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.scroll}>
          <AudioEffectsSection />
        </ScrollView>
      );
    case 'sleep':
      return (
        <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.scroll}>
          <SleepTimerSection />
        </ScrollView>
      );
    case 'crossfade':
      return <CrossfadePanel />;
    case 'navidromeSettings':
      return (
        <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.scroll}>
          <NavidromeSettingsSection />
        </ScrollView>
      );
    case 'lastfmPanel':
      return <LastFmPanel />;
    default:
      return null;
  }
}

function SwitchRow({
  label,
  value,
  onValueChange,
  colors,
}: {
  label: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
  colors: ReturnType<typeof useTheme>['colors'];
}) {
  return (
    <Pressable
      style={styles.optionRow}
      onPress={() => onValueChange(!value)}
    >
      <Text style={[styles.optionLabel, { color: colors.text }]}>{label}</Text>
      <View
        style={[
          styles.switchTrack,
          { backgroundColor: value ? colors.accent : colors.border },
        ]}
      >
        <View
          style={[
            styles.switchThumb,
            { backgroundColor: colors.card, marginLeft: value ? 18 : 2 },
          ]}
        />
      </View>
    </Pressable>
  );
}

function CrossfadePanel() {
  const { colors } = useTheme();
  const {
    crossfadeEnabled,
    setCrossfadeEnabled,
    crossfadeDuration,
    setCrossfadeDuration,
    seamlessEnabled,
    setSeamlessEnabled,
  } = useAudio();

  return (
    <View style={styles.panel}>
      <SwitchRow label="Crossfade" value={crossfadeEnabled} onValueChange={setCrossfadeEnabled} colors={colors} />
      {crossfadeEnabled ? (
        <View style={styles.chipRow}>
          {[2, 4, 6, 8].map((s) => (
            <Pressable
              key={s}
              onPress={() => setCrossfadeDuration(s)}
              style={[
                styles.chip,
                { borderColor: crossfadeDuration === s ? colors.accent : colors.border },
              ]}
            >
              <Text style={[styles.chipText, { color: crossfadeDuration === s ? colors.accent : colors.textSecondary }]}>
                {s}s
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      <SwitchRow label="Seamless Gapless" value={seamlessEnabled} onValueChange={setSeamlessEnabled} colors={colors} />
      <Text style={[styles.hint, { color: colors.textSecondary }]}>
        Crossfade blends tracks; seamless mode plays files back-to-back. They cannot both be active.
      </Text>
    </View>
  );
}

function LastFmPanel() {
  const { colors } = useTheme();
  const { connectLastFm, loadSavedLastFmLogin } = useAudio();
  const [apiKey, setApiKey] = useState('');
  const [sharedSecret, setSharedSecret] = useState('');
  const [token, setToken] = useState('');
  const [credentialLoading, setCredentialLoading] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState('');

  React.useEffect(() => {
    let cancelled = false;
    setCredentialLoading(true);
    loadSavedLastFmLogin()
      .then((saved) => {
        if (cancelled || !saved) return;
        setApiKey(saved.apiKey);
        setSharedSecret(saved.sharedSecret);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setCredentialLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [loadSavedLastFmLogin]);

  const connect = async () => {
    if (!apiKey.trim() || !sharedSecret.trim() || !token.trim()) {
      setError('API key, shared secret and token are all required.');
      return;
    }
    setConnecting(true);
    setError('');
    try {
      const result = await connectLastFm(apiKey.trim(), sharedSecret.trim(), token.trim());
      if (!result.ok) {
        setError(result.error ?? 'Connection failed');
      }
    } catch (e: any) {
      setError(e?.message ?? 'Connection failed');
    } finally {
      setConnecting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.panel}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Text style={[styles.stepLabel, { color: colors.textSecondary }]}>
        Get credentials from https://www.last.fm/api/account/create, then authorize this app and paste its token.
      </Text>
      {credentialLoading ? (
        <ActivityIndicator color={colors.accent} style={{ marginVertical: 12 }} />
      ) : (
        <>
          <Field label="API Key" value={apiKey} onChangeText={setApiKey} placeholder="Last.fm API key" colors={colors} />
          <Field
            label="Shared Secret"
            value={sharedSecret}
            onChangeText={setSharedSecret}
            placeholder="Last.fm shared secret"
            colors={colors}
          />
          <Field label="Token" value={token} onChangeText={setToken} placeholder="Last.fm authorization token" colors={colors} />
        </>
      )}
      {error ? <Text style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}
      <Pressable
        onPress={connect}
        disabled={connecting || credentialLoading}
        style={[styles.connectButton, { backgroundColor: connecting ? colors.border : colors.accent }]}
      >
        {connecting ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={styles.connectText}>Connect Last.fm</Text>
        )}
      </Pressable>
    </KeyboardAvoidingView>
  );
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  colors,
}: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder: string;
  colors: ReturnType<typeof useTheme>['colors'];
}) {
  return (
    <View style={{ marginBottom: 10 }}>
      <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textSecondary}
        autoCapitalize="none"
        autoCorrect={false}
        style={[
          styles.input,
          {
            backgroundColor: colors.card,
            color: colors.text,
            borderColor: colors.border,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingBottom: 24,
  },
  panel: {
    padding: 16,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  optionLabel: {
    fontSize: 16,
    fontWeight: '500',
  },
  switchTrack: {
    width: 42,
    height: 26,
    borderRadius: 13,
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  switchThumb: {
    width: 22,
    height: 22,
    borderRadius: 11,
  },
  chipRow: {
    flexDirection: 'row',
    marginVertical: 10,
  },
  chip: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 6,
    marginRight: 8,
  },
  chipText: {
    fontSize: 14,
    fontWeight: '600',
  },
  hint: {
    fontSize: 12,
    marginTop: 8,
    paddingHorizontal: 8,
    lineHeight: 16,
  },
  stepLabel: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 14,
  },
  fieldLabel: {
    fontSize: 12,
    marginBottom: 4,
    marginLeft: 2,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14,
  },
  error: {
    fontSize: 13,
    marginTop: 6,
  },
  connectButton: {
    marginTop: 14,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  connectText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});