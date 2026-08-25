import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  StyleSheet,
  Text,
  Pressable,
  TextInput,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useAudio } from '../context/AudioContext';
import { ServerConfig } from '../services/NavidromeService';

export function NavidromeSettingsSection() {
  const { colors } = useTheme();
  const {
    navidromeConnected,
    navidromeServerUrl,
    serverConfigs,
    activeServerConfig,
    connectNavidrome,
    disconnectNavidrome,
    loadSavedNavidromeLogin,
    switchServer,
    addServer,
    updateServer,
    deleteServer,
  } = useAudio();

  const [view, setView] = useState<'list' | 'add' | 'edit'>('list');
  const [editingConfig, setEditingConfig] = useState<ServerConfig | null>(null);
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (view === 'edit' && editingConfig) {
      loadSavedNavidromeLogin(editingConfig.id).then((saved) => {
        if (saved) {
          setUrl(saved.url);
          setUsername(saved.username);
          setPassword('');
        }
      });
    }
  }, [view, editingConfig, loadSavedNavidromeLogin]);

  const resetForm = useCallback(() => {
    setName('');
    setUrl('');
    setUsername('');
    setPassword('');
    setError('');
    setEditingConfig(null);
  }, []);

  const handleAdd = async () => {
    if (!url.trim() || !username.trim() || !password.trim()) {
      setError('All fields are required');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const config = await addServer(
        name.trim() || 'My Server',
        url.trim(),
        username.trim(),
        password,
      );
      resetForm();
      setView('list');
    } catch (err: any) {
      setError(err.message || 'Connection failed');
    }
    setLoading(false);
  };

  const handleEdit = async () => {
    if (!editingConfig) return;
    setLoading(true);
    setError('');
    try {
      await updateServer(editingConfig.id, {
        name: name.trim() || undefined,
        url: url.trim() || undefined,
        username: username.trim() || undefined,
        password: password || undefined,
      });
      resetForm();
      setView('list');
    } catch (err: any) {
      setError(err.message || 'Update failed');
    }
    setLoading(false);
  };

  const handleDelete = (config: ServerConfig) => {
    Alert.alert(
      'Delete Server',
      `Delete "${config.name}"? Downloaded tracks and library data for this server will be removed.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => deleteServer(config.id),
        },
      ],
    );
  };

  const handleSwitch = async (config: ServerConfig) => {
    if (config.id === activeServerConfig?.id) return;
    setLoading(true);
    await switchServer(config.id);
    setLoading(false);
  };

  if (view === 'add' || view === 'edit') {
    return (
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
          {view === 'add' ? 'Add Server' : 'Edit Server'}
        </Text>
        <View style={[styles.sectionContent, { backgroundColor: colors.card }]}>
          <View style={styles.inputContainer}>
            <Ionicons name="pricetag-outline" size={20} color={colors.textSecondary} style={styles.inputIcon} />
            <TextInput
              style={[styles.input, { color: colors.text, borderColor: colors.border }]}
              placeholder="Server Name (e.g. Home, Tailscale)"
              placeholderTextColor={colors.textSecondary}
              value={name}
              onChangeText={setName}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
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
              placeholder={view === 'edit' ? 'New password (leave blank to keep)' : 'Password'}
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
            onPress={view === 'add' ? handleAdd : handleEdit}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <Ionicons name="checkmark-circle" size={20} color="#fff" />
                <Text style={styles.connectText}>
                  {view === 'add' ? 'Test & Save' : 'Update'}
                </Text>
              </>
            )}
          </Pressable>
          <Pressable
            style={styles.cancelButton}
            onPress={() => { resetForm(); setView('list'); }}
          >
            <Text style={[styles.cancelText, { color: colors.textSecondary }]}>Cancel</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.section}>
      <View style={styles.headerRow}>
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Servers</Text>
        <Pressable
          style={[styles.addButton, { backgroundColor: colors.accent }]}
          onPress={() => { resetForm(); setView('add'); }}
        >
          <Ionicons name="add" size={20} color="#fff" />
          <Text style={styles.addButtonText}>Add</Text>
        </Pressable>
      </View>
      <View style={[styles.sectionContent, { backgroundColor: colors.card }]}>
        {serverConfigs.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="server-outline" size={40} color={colors.textSecondary} />
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              No servers configured
            </Text>
            <Text style={[styles.emptySubtext, { color: colors.textSecondary }]}>
              Tap + to add your first Navidrome server
            </Text>
          </View>
        ) : (
          serverConfigs.map((config) => {
            const isActive = config.id === activeServerConfig?.id;
            return (
              <Pressable
                key={config.id}
                style={[styles.serverRow, isActive && { backgroundColor: colors.accent + '10' }]}
                onPress={() => handleSwitch(config)}
              >
                <View style={styles.serverInfo}>
                  {isActive ? (
                    <Ionicons name="checkmark-circle" size={22} color="#34C759" />
                  ) : (
                    <Ionicons name="server-outline" size={22} color={colors.textSecondary} />
                  )}
                  <View style={styles.serverTextContainer}>
                    <Text style={[styles.serverName, { color: colors.text }]} numberOfLines={1}>
                      {config.name}
                    </Text>
                    <Text style={[styles.serverUrl, { color: colors.textSecondary }]} numberOfLines={1}>
                      {config.url}
                    </Text>
                  </View>
                </View>
                <View style={styles.serverActions}>
                  <Pressable
                    style={styles.iconButton}
                    onPress={() => {
                      resetForm();
                      setName(config.name);
                      setEditingConfig(config);
                      setView('edit');
                    }}
                  >
                    <Ionicons name="pencil-outline" size={18} color={colors.textSecondary} />
                  </Pressable>
                  <Pressable
                    style={styles.iconButton}
                    onPress={() => handleDelete(config)}
                  >
                    <Ionicons name="trash-outline" size={18} color="#FF3B30" />
                  </Pressable>
                </View>
              </Pressable>
            );
          })
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginTop: 24,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  sectionContent: {
    borderRadius: 12,
    marginHorizontal: 20,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  addButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 32,
    gap: 8,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
  },
  emptySubtext: {
    fontSize: 13,
    textAlign: 'center',
  },
  serverRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  serverInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  serverTextContainer: {
    flex: 1,
  },
  serverName: {
    fontSize: 16,
    fontWeight: '600',
  },
  serverUrl: {
    fontSize: 13,
    marginTop: 2,
  },
  serverActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  iconButton: {
    padding: 8,
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
  cancelButton: {
    alignItems: 'center',
    paddingVertical: 12,
    marginTop: 4,
  },
  cancelText: {
    fontSize: 15,
    fontWeight: '500',
  },
});
