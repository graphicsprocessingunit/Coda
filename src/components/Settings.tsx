import React from 'react';
import { View, StyleSheet, Text, Pressable, Switch } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme, Theme } from '../context/ThemeContext';

interface SettingsProps {
  onClearData: () => void;
}

export function Settings({ onClearData }: SettingsProps) {
  const { theme, colors, setTheme } = useTheme();

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

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Appearance</Text>
        <View style={[styles.sectionContent, { backgroundColor: colors.card }]}>
          {themes.map((t) => (
            <Pressable
              key={t.key}
              style={[styles.settingItem, { borderBottomColor: colors.border }]}
              onPress={() => setTheme(t.key)}
            >
              <View style={styles.settingLeft}>
                <Ionicons name={t.icon as any} size={24} color={colors.textSecondary} />
                <Text style={[styles.settingText, { color: colors.text }]}>{t.name}</Text>
              </View>
              {theme === t.key && (
                <Ionicons name="checkmark-circle" size={24} color={colors.accent} />
              )}
            </Pressable>
          ))}
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
    color: '#8E8E93',
  },
});
