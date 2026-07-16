import React, { useState } from 'react';
import { View, StyleSheet, Text, Pressable, TextInput, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useAudio } from '../context/AudioContext';

export function NavidromeSettingsSection() {
  const { colors } = useTheme();
  const { navidromeConnected, navidromeServerUrl, connectNavidrome, disconnectNavidrome } = useAudio();
  const [url, setUrl] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleConnect = async () => {
    if (!url.trim() || !username.trim() || !password.trim()) {
      setError('All fields are required');
      return;
    }
    setLoading(true);
    setError('');
    const result = await connectNavidrome(url.trim(), username.trim(), password);
    setLoading(false);
    if (!result.ok) {
      setError(result.error || 'Connection failed');
    } else {
      setUrl('');
      setUsername('');
      setPassword('');
    }
  };

  const handleDisconnect = async () => {
    await disconnectNavidrome();
  };

  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Navidrome</Text>
      <View style={[styles.sectionContent, { backgroundColor: colors.card }]}>
        {navidromeConnected ? (
          <>
            <View style={[styles.statusRow, { borderBottomColor: colors.border }]}>
              <View style={styles.statusLeft}>
                <Ionicons name="checkmark-circle" size={24} color="#34C759" />
                <View style={styles.statusTextContainer}>
                  <Text style={[styles.statusText, { color: colors.text }]}>Connected</Text>
                  <Text style={[styles.statusUrl, { color: colors.textSecondary }]} numberOfLines={1}>
                    {navidromeServerUrl}
                  </Text>
                </View>
              </View>
            </View>
            <Pressable
              style={[styles.disconnectButton, { borderBottomColor: colors.border }]}
              onPress={handleDisconnect}
            >
              <Ionicons name="log-out-outline" size={24} color="#FF3B30" />
              <Text style={[styles.disconnectText, { color: '#FF3B30' }]}>Disconnect</Text>
            </Pressable>
          </>
        ) : (
          <>
            <View style={styles.inputContainer}>
              <Ionicons name="globe-outline" size={20} color={colors.textSecondary} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { color: colors.text, borderColor: colors.border }]}
                placeholder="Server URL (e.g., http://192.168.1.10:4533)"
                placeholderTextColor={colors.textSecondary}
                value={url}
                onChangeText={setUrl}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
              />
            </View>
            <View style={styles.inputContainer}>
              <Ionicons name="person-outline" size={20} color={colors.textSecondary} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { color: colors.text, borderColor: colors.border }]}
                placeholder="Username"
                placeholderTextColor={colors.textSecondary}
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
            <View style={styles.inputContainer}>
              <Ionicons name="lock-closed-outline" size={20} color={colors.textSecondary} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { color: colors.text, borderColor: colors.border }]}
                placeholder="Password"
                placeholderTextColor={colors.textSecondary}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
            {error ? (
              <View style={[styles.errorContainer, { backgroundColor: '#FF3B30' + '15' }]}>
                <Ionicons name="alert-circle" size={18} color="#FF3B30" />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}
            <Pressable
              style={[styles.connectButton, { backgroundColor: colors.accent }, loading && { opacity: 0.6 }]}
              onPress={handleConnect}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <Ionicons name="wifi" size={20} color="#fff" />
                  <Text style={styles.connectText}>Connect</Text>
                </>
              )}
            </Pressable>
          </>
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
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  statusLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  statusTextContainer: {
    flex: 1,
  },
  statusText: {
    fontSize: 16,
    fontWeight: '600',
  },
  statusUrl: {
    fontSize: 13,
    marginTop: 2,
  },
  disconnectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingTop: 14,
    borderBottomWidth: 1,
  },
  disconnectText: {
    fontSize: 16,
    fontWeight: '500',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 10,
    marginBottom: 10,
    paddingHorizontal: 12,
  },
  inputIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 15,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    marginBottom: 10,
  },
  errorText: {
    color: '#FF3B30',
    fontSize: 14,
    flex: 1,
  },
  connectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 10,
    marginTop: 4,
  },
  connectText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
