import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useTheme } from '../../context/ThemeContext';
import { useAudio, useIsPlaying, usePlaybackPosition, useBatchDownloads } from '../../context/AudioContext';
import type { TrackMetadata } from '../../context/AudioContext';
import { NavidromeService } from '../../services/NavidromeService';
import type { NavidromeArtist, NavidromeAlbum, NavidromeSong } from '../../services/NavidromeService';

import { ClickWheel } from './ClickWheel';
import { IpodRowList } from './IpodRowList';
import { IpodNowPlaying } from './IpodNowPlaying';
import { IpodEmbedSection } from './IpodSettingsScreens';
import {
  EMBED_SECTIONS,
  buildRows,
  clampIndex,
  screenTitle,
  type IpodScreen,
  type RowsCtx,
} from './menus';

const MAX_WIDTH = 430;

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

type NavIdCache = {
  artists?: NavidromeArtist[];
  albums?: NavidromeAlbum[];
  songs?: NavidromeSong[];
};

export function IpodApp() {
  const { colors, ipod, theme, layout, setTheme, setLayout, setIpodPalette, resetIpodPalette } = useTheme();
  const audio = useAudio();
  const { isPlaying } = useIsPlaying();
  const { playbackPosition, duration } = usePlaybackPosition();
  const { batches, startBatchDownload } = useBatchDownloads();
  const { width } = useWindowDimensions();
  const colWidth = Math.min(width, MAX_WIDTH);

  const [stack, setStack] = useState<IpodScreen[]>([{ type: 'root', highlight: 0 }]);
  const [navidromeData, setNavidromeData] = useState<Record<string, NavIdCache>>({});
  const [loadingKeys, setLoadingKeys] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' | 'info'; id: number } | null>(null);
  const [promptState, setPromptState] = useState<{
    title: string;
    initial: string;
    onSubmit: (value: string) => void;
  } | null>(null);

  const top = stack[stack.length - 1];

  const topRef = useRef(top);
  topRef.current = top;
  const ctxRef = useRef<RowsCtx | null>(null);
  const volumeRef = useRef(audio.volume);
  volumeRef.current = audio.volume;
  const positionRef = useRef(playbackPosition);
  positionRef.current = playbackPosition;
  const durationRef = useRef(duration);
  durationRef.current = duration;
  const isPlayingRef = useRef(isPlaying);
  isPlayingRef.current = isPlaying;
  const toastRef = useRef<(m: string, t: 'success' | 'error' | 'info') => void>(() => {});
  const promptRef = useRef<boolean>(false);
  promptRef.current = promptState !== null;

  const showToast = useCallback((msg: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ msg, type, id: Date.now() });
  }, []);
  toastRef.current = showToast;

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  const push = useCallback((s: IpodScreen) => setStack((st) => [...st, s]), []);
  const pop = useCallback(() => setStack((st) => (st.length > 1 ? st.slice(0, -1) : st)), []);
  const replace = useCallback((s: IpodScreen) => setStack((st) => [...st.slice(0, st.length - 1), s]), []);

  const prompt = useCallback((title: string, initial: string, onSubmit: (value: string) => void) => {
    setPromptState({ title, initial, onSubmit });
  }, []);

  const ctx: RowsCtx = {
    audio,
    colors,
    ipod,
    theme,
    layout,
    setTheme,
    setLayout,
    setIpodPalette,
    resetIpodPalette,
    batches,
    startBatchDownload,
    navidromeData: Object.fromEntries(
      Object.entries(navidromeData).map(([k, v]) => [k, v.artists ?? v.albums ?? v.songs ?? []])
    ),
    nav: { push, pop, replace },
    toast: showToast,
    prompt,
  };
  ctxRef.current = ctx;

  const rows = buildRows(top, ctx);

  const commitScreen = useCallback((s: IpodScreen) => {
    setStack((st) => [...st.slice(0, st.length - 1), s]);
  }, []);

  const loadNavidrome = useCallback(
    async (s: IpodScreen) => {
      if (s.type !== 'navidrome' || !s.key) return;
      if (navidromeData[s.key]) return;
      const creds = audio.getNavidromeCredentials();
      if (!creds) return;
      setLoadingKeys((prev) => new Set(prev).add(s.key!));
      try {
        if (s.view === 'artists') {
          const artists = await NavidromeService.getArtists(creds);
          setNavidromeData((prev) => ({ ...prev, [s.key!]: { artists } }));
        } else if (s.view === 'albums' && s.artist) {
          const result = await NavidromeService.getArtist(creds, s.artist.id);
          setNavidromeData((prev) => ({ ...prev, [s.key!]: { albums: result.albums } }));
        } else if (s.view === 'songs' && s.album) {
          const result = await NavidromeService.getAlbum(creds, s.album.id);
          setNavidromeData((prev) => ({ ...prev, [s.key!]: { songs: result.songs } }));
        }
      } catch (e: any) {
        toastRef.current(`Failed to load Navidrome: ${e?.message ?? e}`, 'error');
      } finally {
        setLoadingKeys((prev) => {
          const next = new Set(prev);
          next.delete(s.key!);
          return next;
        });
      }
    },
    [audio, navidromeData]
  );

  useEffect(() => {
    const s = topRef.current;
    if (s.type === 'navidrome') loadNavidrome(s);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [top.type, top.key, top.view]);

  const handleMenu = useCallback(() => {
    if (promptRef.current) return;
    const s = topRef.current;
    if (s.type === 'reorder') {
      if (s.from != null) commitScreen({ ...s, from: null });
      else pop();
      return;
    }
    if (s.type === 'search' && s.query) {
      commitScreen({ ...s, query: '', highlight: 0 });
      return;
    }
    pop();
  }, [commitScreen, pop]);

  const handleSelect = useCallback(
    (tappedIndex?: number) => {
      if (promptRef.current) return;
      const s = topRef.current;
      const c = ctxRef.current;
      if (!c) return;
      if (s.type === 'reorder') {
        const playlist = c.audio.playlists.find((p) => p.id === s.playlistId);
        if (!playlist) return;
        if (s.from == null) {
          commitScreen({ ...s, from: s.highlight });
        } else {
          const from = s.from;
          const to = s.highlight;
          c.audio.reorderPlaylistTracks(s.playlistId!, from, to);
          toastRef.current('Reordered', 'success');
          pop();
        }
        return;
      }
      const rowsNow = buildRows(s, c);
      const idx = clampIndex(tappedIndex ?? s.highlight, rowsNow.length);
      const row = rowsNow[idx];
      if (row) row.action();
    },
    [commitScreen, pop]
  );

  const handlePrev = useCallback(() => {
    if (promptRef.current) return;
    if (topRef.current.type === 'nowplaying') audio.skipPrevious();
    else handleMenu();
  }, [audio, handleMenu]);

  const handleNext = useCallback(() => {
    if (promptRef.current) return;
    if (topRef.current.type === 'nowplaying') audio.skipNext();
    else handleSelect();
  }, [audio, handleSelect]);

  const handlePlayPause = useCallback(() => {
    if (promptRef.current) return;
    if (isPlayingRef.current) audio.pause();
    else if (audio.currentTrack) audio.play();
  }, [audio]);

  const handleTicks = useCallback(
    (ticks: number) => {
      if (ticks === 0 || promptRef.current) return;
      const s = topRef.current;
      if (s.type === 'nowplaying') {
        const np = s as IpodScreen & { volumeMode?: boolean };
        if (np.volumeMode) {
          const next = clamp(volumeRef.current + ticks * 0.06, 0, 1);
          audio.setVolume(next);
        } else {
          const total = durationRef.current || audio.currentTrack?.duration || 0;
          if (total > 0) {
            const target = clamp(positionRef.current + ticks * 3000, 0, total);
            audio.seekTo(Math.floor(target));
          }
        }
        return;
      }
      const c = ctxRef.current;
      if (!c) return;
      const n = buildRows(s, c).length;
      commitScreen({ ...s, highlight: clampIndex(s.highlight + ticks, n) });
    },
    [audio, commitScreen]
  );

  const topIsNowPlaying = top.type === 'nowplaying';
  const np = top as IpodScreen & { volumeMode?: boolean; lyricsOpen?: boolean };
  const topIsEmbedSettings = top.type === 'settings' && EMBED_SECTIONS.includes(top.section!);
  const topIsSearch = top.type === 'search';
  const navidromeLoading = top.type === 'navidrome' && loadingKeys.has(top.key!);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <SafeAreaView style={styles.safe}>
        <View style={[styles.col, { width: colWidth }]}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
            <View style={styles.topBar}>
              <Pressable onPress={() => setLayout('standard')} hitSlop={8} style={styles.modeSwitch}>
                <Text style={[styles.modeSwitchText, { color: colors.textSecondary }]}>Standard ▸</Text>
              </Pressable>
              <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
                {screenTitle(top)}
              </Text>
              <View style={styles.topRight}>
                {navidromeLoading ? <ActivityIndicator size="small" color={colors.accent} /> : null}
              </View>
            </View>

            <View style={[styles.screen, { backgroundColor: colors.background, borderColor: colors.border }]}>
              {topIsNowPlaying ? (
                <IpodNowPlaying
                  volumeMode={!!np.volumeMode}
                  lyricsOpen={!!np.lyricsOpen}
                  onToggleVolume={() => commitScreen({ ...top, volumeMode: !np.volumeMode, lyricsOpen: false })}
                  onToggleLyrics={() => commitScreen({ ...top, lyricsOpen: !np.lyricsOpen })}
                />
              ) : topIsEmbedSettings ? (
                <View style={styles.flex}>
                  <IpodEmbedSection section={top.section!} />
                </View>
              ) : (
                <View style={styles.flex}>
                  {topIsSearch ? (
                    <TextInput
                      value={top.query || ''}
                      onChangeText={(text) => commitScreen({ ...top, query: text, highlight: 0 })}
                      placeholder="Search library…"
                      placeholderTextColor={colors.textSecondary}
                      style={[
                        styles.searchInput,
                        {
                          backgroundColor: colors.card,
                          color: colors.text,
                          borderColor: colors.border,
                        },
                      ]}
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                  ) : null}
                  <IpodRowList rows={rows} highlight={top.highlight} onSelect={handleSelect} colors={colors} ipod={ipod} />
                </View>
              )}
            </View>

            <View style={styles.wheelArea}>
              <ClickWheel
                isPlaying={isPlaying}
                onMenu={handleMenu}
                onPrevious={handlePrev}
                onNext={handleNext}
                onPlayPause={handlePlayPause}
                onSelect={() => handleSelect()}
                onTicks={handleTicks}
              />
            </View>
          </KeyboardAvoidingView>
        </View>
      </SafeAreaView>

      {toast ? (
        <View style={styles.toastWrap} pointerEvents="none">
          <View style={[styles.toast, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.toastText, { color: toast.type === 'error' ? colors.danger : colors.text }]}>
              {toast.msg}
            </Text>
          </View>
        </View>
      ) : null}

      {promptState ? (
        <PromptOverlay
          title={promptState.title}
          initial={promptState.initial}
          onCancel={() => setPromptState(null)}
          onSubmit={(value) => {
            const cb = promptState.onSubmit;
            setPromptState(null);
            if (value.trim()) cb(value.trim());
          }}
        />
      ) : null}
    </View>
  );
}

function PromptOverlay({
  title,
  initial,
  onCancel,
  onSubmit,
}: {
  title: string;
  initial: string;
  onCancel: () => void;
  onSubmit: (value: string) => void;
}) {
  const { colors, ipod } = useTheme();
  const [value, setValue] = useState(initial);
  const doneText = contrastWhite(ipod.highlight);
  return (
    <View style={[styles.promptOverlay, { backgroundColor: colors.background }]}>
      <Text style={[styles.promptTitle, { color: colors.text }]}>{title}</Text>
      <TextInput
        value={value}
        onChangeText={setValue}
        autoFocus
        placeholder="Name"
        placeholderTextColor={colors.textSecondary}
        onSubmitEditing={() => value.trim() && onSubmit(value)}
        style={[
          styles.promptInput,
          { backgroundColor: colors.card, color: colors.text, borderColor: colors.border },
        ]}
      />
      <View style={styles.promptButtons}>
        <Pressable onPress={onCancel} style={[styles.promptButton, { borderColor: colors.border }]}>
          <Text style={[styles.promptButtonText, { color: colors.textSecondary }]}>Cancel</Text>
        </Pressable>
        <Pressable
          onPress={() => value.trim() && onSubmit(value)}
          style={[styles.promptButton, { backgroundColor: ipod.highlight }]}
        >
          <Text style={[styles.promptButtonText, { color: doneText }]}>Done</Text>
        </Pressable>
      </View>
    </View>
  );
}

function contrastWhite(hex: string) {
  const m = /^#?([0-9a-fA-F]{6})$/.exec(hex);
  if (!m) return '#FFFFFF';
  const n = parseInt(m[1], 16);
  const lum = (0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255;
  return lum > 0.55 ? '#000000' : '#FFFFFF';
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
  },
  safe: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
  },
  flex: {
    flex: 1,
  },
  col: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 14,
    paddingBottom: 8,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 36,
    paddingHorizontal: 12,
  },
  modeSwitch: {
    width: 74,
  },
  modeSwitchText: {
    fontSize: 12,
    fontWeight: '600',
  },
  title: {
    flex: 1,
    textAlign: 'center',
    fontSize: 15,
    fontWeight: '700',
  },
  topRight: {
    width: 74,
    alignItems: 'flex-end',
  },
  screen: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    overflow: 'hidden',
  },
  wheelArea: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 14,
    paddingBottom: 6,
  },
  searchInput: {
    margin: 10,
    marginBottom: 4,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14,
  },
  toastWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 150,
  },
  toast: {
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 18,
    paddingVertical: 10,
    maxWidth: 320,
  },
  toastText: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  promptOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 30,
  },
  promptTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 14,
  },
  promptInput: {
    borderWidth: 1,
    borderRadius: 10,
    width: '100%',
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 16,
  },
  promptButtons: {
    flexDirection: 'row',
    marginTop: 16,
    width: '100%',
    justifyContent: 'space-between',
  },
  promptButton: {
    flex: 1,
    marginHorizontal: 6,
    borderRadius: 10,
    alignItems: 'center',
    paddingVertical: 12,
    borderWidth: 1,
  },
  promptButtonText: {
    fontSize: 15,
    fontWeight: '700',
  },
});