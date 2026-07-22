import React, { createContext, useContext, useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { unstable_batchedUpdates } from 'react-native';
import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import type { AudioPlayer } from 'expo-audio';
import { AppState, AppStateStatus } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { File, Paths } from 'expo-file-system';
import { StorageService } from '../services/StorageService';
import { NavidromeService, NavidromeCredentials } from '../services/NavidromeService';
import { OfflineCacheService } from '../services/OfflineCacheService';
import { LastFmService, LastFmCredentials } from '../services/LastFmService';
import * as AudioEQ from '../../modules/audio-eq/src/index';

export interface TrackMetadata {
  title: string;
  artist: string;
  uri: string;
  duration?: number;
  artwork?: string;
  album?: string;
  source?: 'local' | 'navidrome';
  navidromeId?: string;
  isFavorite?: boolean;
  playCount?: number;
  cachedUri?: string;
  cachedArtwork?: string;
}

export interface Playlist {
  id: string;
  name: string;
  tracks: TrackMetadata[];
  createdAt: number;
}

export type SmartPlaylistRule =
  | { field: 'playCount'; op: 'gte' | 'lte' | 'eq'; value: number }
  | { field: 'isFavorite'; op: 'eq'; value: boolean }
  | { field: 'artist'; op: 'eq' | 'contains'; value: string }
  | { field: 'album'; op: 'eq' | 'contains'; value: string }
  | { field: 'source'; op: 'eq'; value: 'local' | 'navidrome' };

export interface SmartPlaylist {
  id: string;
  name: string;
  rules: SmartPlaylistRule[];
  limit?: number;
  sortField?: 'playCount' | 'title';
  sortDirection?: 'asc' | 'desc';
  createdAt: number;
  icon?: string;
}

export type AudioPreset = 'flat' | 'relaxed' | 'clear' | 'upbeat' | 'quiet';

export type EqPresetName = 'flat' | 'bass-boost' | 'treble' | 'vocal' | 'rock' | 'pop';

export const EQ_PRESETS: Record<EqPresetName, number[]> = {
  flat: [0, 0, 0, 0, 0],
  'bass-boost': [6, 4, 0, -1, -2],
  treble: [-2, -1, 0, 4, 6],
  vocal: [-2, 0, 3, 3, 0],
  rock: [5, 3, -1, 2, 4],
  pop: [-1, 2, 4, 2, -1],
};

export const EQ_BAND_LABELS = ['60 Hz', '230 Hz', '910 Hz', '3.6 kHz', '14 kHz'];

interface AudioContextType {
  currentTrack: TrackMetadata | null;
  isPlaying: boolean;
  queue: TrackMetadata[];
  library: TrackMetadata[];
  playlists: Playlist[];
  shuffleEnabled: boolean;
  repeatEnabled: boolean;
  playbackRate: number;
  volume: number;
  audioPreset: AudioPreset;
  sleepTimerEnd: number | null;
  sleepTimerRemaining: number;
  loadTrack: (trackUri: string, metadata: TrackMetadata, autoPlay?: boolean) => Promise<void>;
  play: () => Promise<void>;
  pause: () => Promise<void>;
  seekTo: (position: number) => Promise<void>;
  skipNext: () => void;
  skipPrevious: () => void;
  removeFromQueue: (index: number) => void;
  addToQueue: (track: TrackMetadata) => void;
  playNextInQueue: (track: TrackMetadata) => void;
  reorderQueue: (fromIndex: number, toIndex: number) => void;
  shuffleQueue: () => void;
  setQueue: (tracks: TrackMetadata[]) => void;
  toggleShuffle: () => void;
  toggleRepeat: () => void;
  addToLibrary: (tracks: TrackMetadata[]) => void;
  removeFromLibrary: (trackUri: string) => void;
  downloadTrackForLibrary: (track: TrackMetadata) => Promise<boolean>;
  playFromLibrary: (track: TrackMetadata) => Promise<void>;
  playFromPlaylist: (playlist: Playlist, track: TrackMetadata) => Promise<void>;
  createPlaylist: (name: string) => string;
  addTrackToPlaylist: (playlistId: string, track: TrackMetadata) => void;
  removeTrackFromPlaylist: (playlistId: string, trackUri: string) => void;
  reorderPlaylistTracks: (playlistId: string, fromIndex: number, toIndex: number) => void;
  deletePlaylist: (playlistId: string) => void;
  renamePlaylist: (playlistId: string, newName: string) => void;
  playPlaylist: (playlist: Playlist) => Promise<void>;
  smartPlaylists: SmartPlaylist[];
  createSmartPlaylist: (name: string, rules: SmartPlaylistRule[], options?: { limit?: number; sortField?: 'playCount' | 'title'; sortDirection?: 'asc' | 'desc'; icon?: string }) => string;
  updateSmartPlaylist: (id: string, updates: Partial<Omit<SmartPlaylist, 'id' | 'createdAt'>>) => void;
  deleteSmartPlaylist: (id: string) => void;
  setPlaybackRate: (rate: number) => Promise<void>;
  setVolume: (vol: number) => Promise<void>;
  setAudioPreset: (preset: AudioPreset) => void;
  eqEnabled: boolean;
  eqBands: number[];
  eqPreset: EqPresetName | null;
  setEqBandGain: (band: number, gain: number) => void;
  setEqPreset: (preset: EqPresetName) => void;
  setEqEnabled: (enabled: boolean) => void;
  setSleepTimer: (minutes: number) => void;
  cancelSleepTimer: () => void;
  navidromeConnected: boolean;
  navidromeServerUrl: string;
  connectNavidrome: (url: string, username: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  disconnectNavidrome: () => Promise<void>;
  getNavidromeCredentials: () => NavidromeCredentials | null;
  crossfadeEnabled: boolean;
  crossfadeDuration: number;
  setCrossfadeEnabled: (enabled: boolean) => void;
  setCrossfadeDuration: (seconds: number) => void;
  seamlessEnabled: boolean;
  setSeamlessEnabled: (enabled: boolean) => void;
  clearAllData: () => void;
  lastFmConnected: boolean;
  connectLastFm: (apiKey: string, sharedSecret: string, token: string) => Promise<{ ok: boolean; error?: string }>;
  disconnectLastFm: () => Promise<void>;
  toggleFavorite: (uri: string) => void;
  batchToggleFavorite: (uris: string[]) => void;
  batchRemoveFromLibrary: (uris: string[]) => void;
  error: string | null;
  clearError: () => void;
  isLoading: boolean;
}

const AudioCtx = createContext<AudioContextType | undefined>(undefined);

interface PlaybackPositionType {
  playbackPosition: number;
  duration: number;
}

const PlaybackPositionCtx = createContext<PlaybackPositionType>({ playbackPosition: 0, duration: 0 });

export function usePlaybackPosition() {
  return useContext(PlaybackPositionCtx);
}

interface DownloadProgressType {
  activeDownloads: Map<string, number>;
  cancelDownload: (uri: string) => void;
}

const DownloadProgressCtx = createContext<DownloadProgressType>({
  activeDownloads: new Map(),
  cancelDownload: () => {},
});

export function useDownloadProgress() {
  return useContext(DownloadProgressCtx);
}

function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function updateLockScreen(player: AudioPlayer, track: TrackMetadata) {
  player.setActiveForLockScreen(true, {
    title: track.title,
    artist: track.artist,
    albumTitle: track.album,
    artworkUrl: track.artwork,
  }, {
    showSeekForward: true,
    showSeekBackward: true,
  });
}

function destroyPlayer(player: AudioPlayer | null) {
  if (!player) return;
  try {
    player.clearLockScreenControls();
    player.remove();
  } catch {}
}

export function AudioProvider({ children }: { children: React.ReactNode }) {
  const [currentTrack, setCurrentTrack] = useState<TrackMetadata | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [queue, setQueue] = useState<TrackMetadata[]>([]);
  const [library, setLibrary] = useState<TrackMetadata[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [playbackPosition, setPlaybackPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [shuffleEnabled, setShuffleEnabled] = useState(false);
  const [repeatEnabled, setRepeatEnabled] = useState(false);
  const [playbackRate, setPlaybackRateState] = useState(1.0);
  const [volume, setVolumeState] = useState(1.0);
  const [audioPreset, setAudioPresetState] = useState<AudioPreset>('flat');
  const [eqEnabled, setEqEnabledState] = useState(true);
  const [eqBands, setEqBandsState] = useState<number[]>([0, 0, 0, 0, 0]);
  const [eqPreset, setEqPresetState] = useState<EqPresetName | null>('flat');
  const [sleepTimerEnd, setSleepTimerEnd] = useState<number | null>(null);
  const [sleepTimerRemaining, setSleepTimerRemaining] = useState(0);
  const [crossfadeEnabled, setCrossfadeEnabledState] = useState(false);
  const [crossfadeDuration, setCrossfadeDurationState] = useState(0);
  const [seamlessEnabled, setSeamlessEnabledState] = useState(false);
  const [navidromeConnected, setNavidromeConnected] = useState(false);
  const [navidromeServerUrl, setNavidromeServerUrl] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeDownloads, setActiveDownloads] = useState<Map<string, number>>(new Map());
  const [smartPlaylists, setSmartPlaylists] = useState<SmartPlaylist[]>([]);
  const [lastFmConnected, setLastFmConnected] = useState(false);
  const navidromeCredentialsRef = useRef<NavidromeCredentials | null>(null);
  const lastFmCredsRef = useRef<LastFmCredentials | null>(null);
  const scrobbleSubmittedRef = useRef(false);
  const listeningStartRef = useRef(0);
  const lastFmConnectedRef = useRef(false);
  const currentTrackRef = useRef<TrackMetadata | null>(null);

  const soundRef = useRef<AudioPlayer | null>(null);
  const playbackStatusRef = useRef<any>(null);
  const repeatEnabledRef = useRef(false);
  const shuffleEnabledRef = useRef(false);
  const queueRef = useRef<TrackMetadata[]>([]);
  const historyRef = useRef<TrackMetadata[]>([]);
  const historyIndexRef = useRef(-1);
  const seekingRef = useRef(false);
  const sourceTracksRef = useRef<TrackMetadata[]>([]);
  const sleepTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fadeIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const preFadeVolumeRef = useRef(1.0);
  const isFadingRef = useRef(false);
  const positionSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedPositionRef = useRef(0);
  const loadGenerationRef = useRef(0);
  const crossfadeSoundRef = useRef<AudioPlayer | null>(null);
  const crossfadeActiveRef = useRef(false);
  const crossfadeStartedRef = useRef(false);
  const crossfadeTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const crossfadeEnabledRef = useRef(false);
  const crossfadeDurationRef = useRef(0);
  const seamlessEnabledRef = useRef(false);
  const volumeRef = useRef(1.0);
  const libraryRef = useRef<TrackMetadata[]>([]);
  const preloadRef = useRef<AudioPlayer | null>(null);
  const preloadedUriRef = useRef<string | null>(null);
  const isLoadedRef = useRef(false);
  const saveLibraryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savePlaylistsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveQueueTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveSmartPlaylistsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const debouncedSaveLibrary = useCallback((lib: TrackMetadata[]) => {
    if (saveLibraryTimerRef.current) clearTimeout(saveLibraryTimerRef.current);
    saveLibraryTimerRef.current = setTimeout(() => {
      StorageService.saveLibrary(lib);
      saveLibraryTimerRef.current = null;
    }, 1000);
  }, []);

  const debouncedSavePlaylists = useCallback((pls: Playlist[]) => {
    if (savePlaylistsTimerRef.current) clearTimeout(savePlaylistsTimerRef.current);
    savePlaylistsTimerRef.current = setTimeout(() => {
      StorageService.savePlaylists(pls);
      savePlaylistsTimerRef.current = null;
    }, 1000);
  }, []);

  const debouncedSaveQueue = useCallback((q: TrackMetadata[]) => {
    if (saveQueueTimerRef.current) clearTimeout(saveQueueTimerRef.current);
    saveQueueTimerRef.current = setTimeout(() => {
      StorageService.saveQueue(q);
      saveQueueTimerRef.current = null;
    }, 1000);
  }, []);

  const debouncedSaveSmartPlaylists = useCallback((sps: SmartPlaylist[]) => {
    if (saveSmartPlaylistsTimerRef.current) clearTimeout(saveSmartPlaylistsTimerRef.current);
    saveSmartPlaylistsTimerRef.current = setTimeout(() => {
      StorageService.saveSmartPlaylists(sps);
      saveSmartPlaylistsTimerRef.current = null;
    }, 1000);
  }, []);

  const debouncedSavePosition = useCallback((position: number) => {
    if (Math.abs(position - lastSavedPositionRef.current) < 1000) return;
    if (positionSaveTimerRef.current) {
      clearTimeout(positionSaveTimerRef.current);
    }
    positionSaveTimerRef.current = setTimeout(() => {
      StorageService.savePlaybackPosition(position);
      lastSavedPositionRef.current = position;
      positionSaveTimerRef.current = null;
    }, 5000);
  }, []);

  const savePositionImmediate = useCallback((position: number) => {
    if (positionSaveTimerRef.current) {
      clearTimeout(positionSaveTimerRef.current);
      positionSaveTimerRef.current = null;
    }
    StorageService.savePlaybackPosition(position);
    lastSavedPositionRef.current = position;
  }, []);

  useEffect(() => {
    repeatEnabledRef.current = repeatEnabled;
  }, [repeatEnabled]);

  useEffect(() => {
    shuffleEnabledRef.current = shuffleEnabled;
  }, [shuffleEnabled]);

  useEffect(() => {
    queueRef.current = queue;
  }, [queue]);

  useEffect(() => {
    crossfadeEnabledRef.current = crossfadeEnabled;
  }, [crossfadeEnabled]);

  useEffect(() => {
    crossfadeDurationRef.current = crossfadeDuration;
  }, [crossfadeDuration]);

  useEffect(() => {
    seamlessEnabledRef.current = seamlessEnabled;
  }, [seamlessEnabled]);

  useEffect(() => {
    volumeRef.current = volume;
  }, [volume]);

  useEffect(() => {
    libraryRef.current = library;
  }, [library]);

  useEffect(() => {
    currentTrackRef.current = currentTrack;
  }, [currentTrack]);

  useEffect(() => {
    return () => {
      destroyPlayer(soundRef.current);
      destroyPlayer(crossfadeSoundRef.current);
      if (preloadRef.current) {
        try {
          preloadRef.current.clearLockScreenControls();
          preloadRef.current.remove();
        } catch {}
      }
      if (sleepTimerRef.current) clearInterval(sleepTimerRef.current);
      if (fadeIntervalRef.current) clearInterval(fadeIntervalRef.current);
      if (positionSaveTimerRef.current) clearTimeout(positionSaveTimerRef.current);
      if (crossfadeTimerRef.current) clearInterval(crossfadeTimerRef.current);
      if (saveLibraryTimerRef.current) clearTimeout(saveLibraryTimerRef.current);
      if (savePlaylistsTimerRef.current) clearTimeout(savePlaylistsTimerRef.current);
      if (saveQueueTimerRef.current) clearTimeout(saveQueueTimerRef.current);
      if (saveSmartPlaylistsTimerRef.current) clearTimeout(saveSmartPlaylistsTimerRef.current);
    };
  }, []);

  useEffect(() => {
    const handleAppStateChange = (nextState: AppStateStatus) => {
      if (nextState === 'active') {
        checkSleepTimerExpiryRef.current();
      }
    };
    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    const loadSavedData = async () => {
      const savedLibrary = await StorageService.loadLibrary();
      const savedPlaylists = await StorageService.loadPlaylists();
      const savedCurrentTrack = await StorageService.loadCurrentTrack();
      const savedPlaybackPosition = await StorageService.loadPlaybackPosition();
      const savedQueue = await StorageService.loadQueue();
      const savedSmartPlaylists = await StorageService.loadSmartPlaylists();

      if (savedLibrary.length > 0) setLibrary(savedLibrary);
      if (savedPlaylists.length > 0) setPlaylists(savedPlaylists);
      if (savedQueue.length > 0) setQueue(savedQueue);
      if (savedSmartPlaylists.length > 0) setSmartPlaylists(savedSmartPlaylists);

      await setAudioModeAsync({
        playsInSilentMode: true,
        shouldPlayInBackground: true,
        interruptionMode: 'doNotMix',
      });

      if (savedCurrentTrack && savedCurrentTrack.source !== 'navidrome') {
        const libMatch = libraryRef.current.find(t => t.uri === savedCurrentTrack.uri);
        setCurrentTrack({ ...savedCurrentTrack, isFavorite: libMatch?.isFavorite ?? savedCurrentTrack.isFavorite ?? false });
        try {
          const player = createAudioPlayer(
            { uri: savedCurrentTrack.uri },
            { updateInterval: 500 }
          );
          player.addListener('playbackStatusUpdate', onPlaybackStatusUpdate);
          soundRef.current = player;
          if (savedPlaybackPosition > 0) {
            await player.seekTo(savedPlaybackPosition / 1000);
          }
          const status = player.currentStatus;
          if (status.isLoaded) {
            setDuration((status.duration || 0) * 1000);
          }
          updateLockScreen(player, savedCurrentTrack);
        } catch (error) {
          console.error('Error restoring track:', error);
        }
      }

      const savedNavidromeCreds = await NavidromeService.loadCredentials();
      if (savedNavidromeCreds) {
        navidromeCredentialsRef.current = savedNavidromeCreds;
        setNavidromeConnected(true);
        setNavidromeServerUrl(savedNavidromeCreds.url);
      }

      const lastFmCreds = await LastFmService.loadCredentials();
      if (lastFmCreds) {
        lastFmCredsRef.current = lastFmCreds;
        lastFmConnectedRef.current = true;
        setLastFmConnected(true);
      }

      const savedSleepTimerEnd = await AsyncStorage.getItem('@coda_sleep_timer_end');
      if (savedSleepTimerEnd) {
        const endTime = parseInt(savedSleepTimerEnd, 10);
        const remaining = Math.max(0, Math.ceil((endTime - Date.now()) / 1000));
        if (remaining > 0) {
          setSleepTimerEnd(endTime);
          setSleepTimerRemaining(remaining);
          sleepTimerRef.current = setInterval(() => {
            const rem = Math.max(0, Math.ceil((endTime - Date.now()) / 1000));
            setSleepTimerRemaining(rem);
            if (rem <= 0) {
              cancelSleepTimer();
              if (soundRef.current) {
                soundRef.current.pause();
                setIsPlaying(false);
              }
            }
          }, 1000);
        } else {
          AsyncStorage.removeItem('@coda_sleep_timer_end');
        }
      }

      const savedCrossfadeEnabled = await AsyncStorage.getItem('@coda_crossfade_enabled');
      const savedCrossfadeDuration = await AsyncStorage.getItem('@coda_crossfade_duration');
      if (savedCrossfadeEnabled === 'true') {
        setCrossfadeEnabledState(true);
        crossfadeEnabledRef.current = true;
      }
      if (savedCrossfadeDuration) {
        const dur = parseInt(savedCrossfadeDuration, 10);
        setCrossfadeDurationState(dur);
        crossfadeDurationRef.current = dur;
      }

      const savedSeamlessEnabled = await AsyncStorage.getItem('@coda_seamless_enabled');
      if (savedSeamlessEnabled === 'true') {
        setSeamlessEnabledState(true);
        seamlessEnabledRef.current = true;
        if (!crossfadeEnabledRef.current) {
          setCrossfadeEnabledState(true);
          crossfadeEnabledRef.current = true;
        }
        if (!crossfadeDurationRef.current) {
          setCrossfadeDurationState(2);
          crossfadeDurationRef.current = 2;
        }
      }

      const savedEqEnabled = await AsyncStorage.getItem('@coda_eq_enabled');
      const savedEqBands = await AsyncStorage.getItem('@coda_eq_bands');
      const savedEqPreset = await AsyncStorage.getItem('@coda_eq_preset');
      try {
        await AudioEQ.initialize();
        if (savedEqEnabled !== null) {
          const enabled = savedEqEnabled === 'true';
          setEqEnabledState(enabled);
          await AudioEQ.setEnabled(enabled);
        }
        if (savedEqBands) {
          const bands = JSON.parse(savedEqBands) as number[];
          setEqBandsState(bands);
          for (let i = 0; i < bands.length; i++) {
            await AudioEQ.setBandGain(i, bands[i]);
          }
        }
        if (savedEqPreset) {
          setEqPresetState(savedEqPreset as EqPresetName);
        }
      } catch {
        // Native EQ module not available (e.g. web)
      }

      isLoadedRef.current = true;
      setIsLoading(false);
    };

    loadSavedData();
  }, []);

  useEffect(() => {
    if (!isLoadedRef.current) return;
    debouncedSaveLibrary(library);
  }, [library, debouncedSaveLibrary]);

  useEffect(() => {
    if (!isLoadedRef.current) return;
    debouncedSavePlaylists(playlists);
  }, [playlists, debouncedSavePlaylists]);

  useEffect(() => {
    if (!isLoadedRef.current) return;
    if (currentTrack) {
      StorageService.saveCurrentTrack(currentTrack);
    }
  }, [currentTrack]);

  useEffect(() => {
    if (!isLoadedRef.current) return;
    debouncedSaveQueue(queue);
  }, [queue, debouncedSaveQueue]);

  useEffect(() => {
    if (!isLoadedRef.current) return;
    debouncedSaveSmartPlaylists(smartPlaylists);
  }, [smartPlaylists, debouncedSaveSmartPlaylists]);

  const loadTrackInternal = useCallback(async (trackUri: string, metadata: TrackMetadata, autoPlay = false) => {
    const generation = ++loadGenerationRef.current;
    crossfadeStartedRef.current = false;

    if (crossfadeActiveRef.current) {
      crossfadeActiveRef.current = false;
      if (crossfadeTimerRef.current) {
        clearInterval(crossfadeTimerRef.current);
        crossfadeTimerRef.current = null;
      }
      if (crossfadeSoundRef.current) {
        const cfPlayer = crossfadeSoundRef.current;
        crossfadeSoundRef.current = null;
        destroyPlayer(cfPlayer);
      }
    }

    if (soundRef.current) {
      const prevPlayer = soundRef.current;
      const prevStatus = playbackStatusRef.current;
      if (prevStatus?.isLoaded) {
        savePositionImmediate((prevStatus.currentTime || 0) * 1000);
      }
      destroyPlayer(prevPlayer);
      soundRef.current = null;
    }

    if (preloadRef.current && preloadedUriRef.current !== trackUri) {
      try {
        preloadRef.current.clearLockScreenControls();
        preloadRef.current.remove();
      } catch {}
      preloadRef.current = null;
      preloadedUriRef.current = null;
    }

    const resolvedUri = metadata.cachedUri || trackUri;
    const player = createAudioPlayer(
      { uri: resolvedUri },
      { updateInterval: 500 }
    );

    if (generation !== loadGenerationRef.current) {
      destroyPlayer(player);
      return;
    }

    player.addListener('playbackStatusUpdate', onPlaybackStatusUpdate);
    soundRef.current = player;

    if (autoPlay) player.play();

    const libMatch = libraryRef.current.find(t => t.uri === metadata.uri);
    unstable_batchedUpdates(() => {
      setCurrentTrack({ ...metadata, isFavorite: libMatch?.isFavorite ?? metadata.isFavorite ?? false });
      setPlaybackPosition(0);
      const status = player.currentStatus;
      if (status.isLoaded) {
        setDuration((status.duration || 0) * 1000);
      }
      setIsPlaying(autoPlay);
    });
    listeningStartRef.current = Date.now();
    scrobbleSubmittedRef.current = false;
    if (lastFmConnectedRef.current && lastFmCredsRef.current) {
      LastFmService.nowPlaying(lastFmCredsRef.current, metadata).catch(() => {});
    }

    updateLockScreen(player, metadata);

    if (autoPlay) {
      setTimeout(() => preloadNextTrack(), 100);
    }
  }, []);

  const playNextFromQueue = useCallback(() => {
    const currentQueue = queueRef.current;
    if (currentQueue.length > 0) {
      const nextTrack = currentQueue[0];
      const remainingQueue = currentQueue.slice(1);
      unstable_batchedUpdates(() => {
        setQueue(remainingQueue);
        incrementPlayCount(nextTrack.uri);
      });
      historyRef.current.push(nextTrack);
      historyIndexRef.current = historyRef.current.length - 1;
      loadTrackInternal(nextTrack.uri, nextTrack, true);
    } else if (sourceTracksRef.current.length > 0) {
      const tracks = sourceTracksRef.current;
      const firstTrack = tracks[0];
      const remainingTracks = tracks.slice(1);
      unstable_batchedUpdates(() => {
        setQueue(remainingTracks);
        incrementPlayCount(firstTrack.uri);
      });
      historyRef.current = [firstTrack];
      historyIndexRef.current = 0;
      loadTrackInternal(firstTrack.uri, firstTrack, true);
    }
  }, []);

  const getNextTrack = useCallback((): TrackMetadata | null => {
    const currentQueue = queueRef.current;
    if (currentQueue.length > 0) return currentQueue[0];
    if (sourceTracksRef.current.length > 0) return sourceTracksRef.current[0];
    return null;
  }, []);

  const preloadNextTrack = useCallback(() => {
    if (!seamlessEnabledRef.current) return;
    if (repeatEnabledRef.current) return;

    const nextTrack = getNextTrack();
    if (!nextTrack) return;
    if (preloadedUriRef.current === nextTrack.uri) return;

    if (preloadRef.current) {
      try {
        preloadRef.current.clearLockScreenControls();
        preloadRef.current.remove();
      } catch {}
      preloadRef.current = null;
    }

    try {
      const preloadUri = nextTrack.cachedUri || nextTrack.uri;
      const preloadPlayer = createAudioPlayer(
        { uri: preloadUri },
        { updateInterval: 1000 }
      );
      preloadRef.current = preloadPlayer;
      preloadedUriRef.current = preloadUri;
    } catch (error) {
      console.error('Preload error:', error);
      preloadRef.current = null;
      preloadedUriRef.current = null;
    }
  }, [getNextTrack]);

  const startCrossfade = useCallback(async () => {
    if (crossfadeActiveRef.current || crossfadeStartedRef.current) return;
    if (!crossfadeEnabledRef.current || crossfadeDurationRef.current <= 0) return;
    if (repeatEnabledRef.current) return;

    const nextTrack = getNextTrack();
    if (!nextTrack) return;
    if (!soundRef.current) return;

    crossfadeActiveRef.current = true;
    crossfadeStartedRef.current = true;

    const durationMs = crossfadeDurationRef.current * 1000;
    const currentVol = volumeRef.current;
    const steps = 20;
    const stepDuration = durationMs / steps;
    let step = 0;

    try {
      let newPlayer: AudioPlayer;

      if (preloadRef.current && preloadedUriRef.current === nextTrack.uri) {
        newPlayer = preloadRef.current;
        preloadRef.current = null;
        preloadedUriRef.current = null;
      } else {
        newPlayer = createAudioPlayer(
          { uri: nextTrack.cachedUri || nextTrack.uri },
          { updateInterval: 500 }
        );
      }

      if (!crossfadeActiveRef.current) {
        destroyPlayer(newPlayer);
        return;
      }

      newPlayer.addListener('playbackStatusUpdate', onPlaybackStatusUpdate);
      newPlayer.volume = 0;
      newPlayer.play();

      crossfadeTimerRef.current = setInterval(() => {
        step++;
        const oldVol = Math.max(0, currentVol * (1 - step / steps));
        const newVol = Math.min(currentVol, currentVol * (step / steps));

        try {
          if (soundRef.current) soundRef.current.volume = oldVol;
          newPlayer.volume = newVol;
        } catch {}

        if (step >= steps) {
          if (crossfadeTimerRef.current) {
            clearInterval(crossfadeTimerRef.current);
            crossfadeTimerRef.current = null;
          }

          try {
            const oldPlayer = soundRef.current;
            if (oldPlayer) {
              const oldStatus = oldPlayer.currentStatus;
              if (oldStatus.isLoaded) {
                savePositionImmediate((oldStatus.currentTime || 0) * 1000);
              }
              destroyPlayer(oldPlayer);
            }
          } catch {}

          soundRef.current = newPlayer;

          const currentQueue = queueRef.current;
          if (currentQueue.length > 0) {
            const nextInQueue = currentQueue[0];
            setQueue(currentQueue.slice(1));
            historyRef.current.push(nextInQueue);
            historyIndexRef.current = historyRef.current.length - 1;
          } else if (sourceTracksRef.current.length > 0) {
            const tracks = sourceTracksRef.current;
            const playedSet = new Set(historyRef.current.map(t => t.uri));
            const remaining = tracks.filter(t => !playedSet.has(t.uri));
            if (remaining.length > 0) {
              const nextTrack = remaining[0];
              historyRef.current.push(nextTrack);
              historyIndexRef.current = historyRef.current.length - 1;
              setQueue(remaining.slice(1));
            } else {
              crossfadeActiveRef.current = false;
              newPlayer.pause();
              return;
            }
          }

          const libMatch = libraryRef.current.find(t => t.uri === nextTrack.uri);
          setCurrentTrack({ ...nextTrack, isFavorite: libMatch?.isFavorite ?? nextTrack.isFavorite ?? false });
          incrementPlayCount(nextTrack.uri);
          setPlaybackPosition(0);

          const newStatus = newPlayer.currentStatus;
          if (newStatus.isLoaded) {
            setDuration((newStatus.duration || 0) * 1000);
          }

          updateLockScreen(newPlayer, nextTrack);
          crossfadeActiveRef.current = false;

          if (seamlessEnabledRef.current) {
            setTimeout(() => preloadNextTrack(), 100);
          }
        }
      }, stepDuration);
    } catch (error) {
      console.error('Crossfade error:', error);
      crossfadeActiveRef.current = false;
    }
  }, [getNextTrack, savePositionImmediate]);

  const onPlaybackStatusUpdate = useCallback((status: any) => {
    playbackStatusRef.current = status;
    if (status.isLoaded) {
      const positionMs = (status.currentTime || 0) * 1000;
      const durationMs = (status.duration || 0) * 1000;

      unstable_batchedUpdates(() => {
        if (!seekingRef.current) {
          setPlaybackPosition(positionMs);
        }
        setDuration(durationMs);
        setIsPlaying(status.playing);
      });
      if (!seekingRef.current) {
        debouncedSavePosition(positionMs);
      }

      if (status.didJustFinish) {
        if (crossfadeActiveRef.current) {
          return;
        }
        if (repeatEnabledRef.current) {
          soundRef.current?.seekTo(0);
          soundRef.current?.play();
        } else {
          playNextFromQueue();
        }
      }

      if (crossfadeEnabledRef.current && crossfadeDurationRef.current > 0 && !repeatEnabledRef.current && !crossfadeActiveRef.current && !crossfadeStartedRef.current) {
        const remaining = durationMs - positionMs;
        if (remaining <= crossfadeDurationRef.current * 1000 + 500 && remaining > 0) {
          startCrossfade();
        }
      }

      if (lastFmConnectedRef.current && lastFmCredsRef.current && !scrobbleSubmittedRef.current) {
        const elapsed = (Date.now() - listeningStartRef.current) / 1000;
        const durationSec = status.duration || 0;
        const threshold = Math.min(240, durationSec / 2);
        if (elapsed >= threshold && threshold > 0) {
          scrobbleSubmittedRef.current = true;
          const currentMeta = currentTrackRef.current;
          if (currentMeta) {
            LastFmService.scrobble(
              lastFmCredsRef.current,
              currentMeta,
              Math.floor(listeningStartRef.current / 1000)
            ).catch(() => {});
          }
        }
      }
    }
  }, [playNextFromQueue, startCrossfade]);

  const loadTrack = useCallback(async (trackUri: string, metadata: TrackMetadata, autoPlay = false) => {
    try {
      await loadTrackInternal(trackUri, metadata, autoPlay);
    } catch (error) {
      console.error('Error loading track:', error);
      setError('Failed to load track');
    }
  }, [loadTrackInternal]);

  const play = useCallback(async () => {
    if (!soundRef.current) return;
    try {
      const status = soundRef.current.currentStatus;
      if (status.isLoaded) {
        soundRef.current.play();
        setIsPlaying(true);
      }
    } catch (error) {
      console.error('Error playing:', error);
      setError('Playback error');
    }
  }, []);

  const pause = useCallback(async () => {
    if (soundRef.current) {
      try {
        soundRef.current.pause();
        setIsPlaying(false);
        const status = soundRef.current.currentStatus;
        if (status.isLoaded) {
          savePositionImmediate((status.currentTime || 0) * 1000);
        }
      } catch (error) {
        console.error('Error pausing:', error);
        setError('Playback error');
      }
    }
  }, []);

  const seekTo = useCallback(async (position: number) => {
    if (soundRef.current) {
      try {
        seekingRef.current = true;
        await soundRef.current.seekTo(position / 1000);
        setPlaybackPosition(position);
        savePositionImmediate(position);
        setTimeout(() => {
          seekingRef.current = false;
        }, 600);
      } catch (error) {
        seekingRef.current = false;
        console.error('Error seeking:', error);
      }
    }
  }, []);

  const skipNext = useCallback(() => {
    if (historyIndexRef.current < historyRef.current.length - 1) {
      historyIndexRef.current += 1;
      const track = historyRef.current[historyIndexRef.current];
      loadTrackInternal(track.uri, track, true);
    } else {
      playNextFromQueue();
    }
  }, [loadTrackInternal, playNextFromQueue]);

  const skipPrevious = useCallback(() => {
    if (historyIndexRef.current > 0) {
      historyIndexRef.current -= 1;
      const track = historyRef.current[historyIndexRef.current];
      loadTrackInternal(track.uri, track, true);
    } else if (soundRef.current) {
      seekTo(0);
    }
  }, [loadTrackInternal, seekTo]);

  const removeFromQueue = useCallback((index: number) => {
    setQueue((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const addToQueue = useCallback((track: TrackMetadata) => {
    setQueue((prev) => [...prev, track]);
  }, []);

  const playNextInQueue = useCallback((track: TrackMetadata) => {
    setQueue((prev) => [track, ...prev]);
  }, []);

  const reorderQueue = useCallback((fromIndex: number, toIndex: number) => {
    setQueue((prev) => {
      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
  }, []);

  const shuffleQueue = useCallback(() => {
    setQueue((prev) => shuffleArray(prev));
  }, []);

  const addToLibrary = useCallback((tracks: TrackMetadata[]) => {
    setLibrary((prev) => [...prev, ...tracks]);
  }, []);

  const removeFromLibrary = useCallback((trackUri: string) => {
    setLibrary((prev) => prev.filter((track) => track.uri !== trackUri));
    setPlaylists((prev) =>
      prev.map((playlist) => ({
        ...playlist,
        tracks: playlist.tracks.filter((t) => t.uri !== trackUri),
      }))
    );
    setQueue((prev) => {
      const next = prev.filter((t) => t.uri !== trackUri);
      queueRef.current = next;
      return next;
    });
  }, []);

  const downloadTrackForLibrary = useCallback(async (track: TrackMetadata): Promise<boolean> => {
    const creds = navidromeCredentialsRef.current;
    if (!creds || !track.navidromeId) return false;

    const controller = OfflineCacheService.getAbortController(track.uri);
    setActiveDownloads((prev) => new Map(prev).set(track.uri, 0));

    let lastUpdate = 0;
    try {
      const offlineTrack = await OfflineCacheService.downloadTrackForOffline(
        creds, track,
        (progress) => {
          const now = Date.now();
          if (now - lastUpdate < 100 && progress < 1) return;
          lastUpdate = now;
          setActiveDownloads((prev) => new Map(prev).set(track.uri, progress));
        },
        controller.signal,
      );

      setActiveDownloads((prev) => {
        const next = new Map(prev);
        next.delete(track.uri);
        return next;
      });
      OfflineCacheService.removeController(track.uri);

      if (!offlineTrack.cachedUri) return false;

      setLibrary((prev) =>
        prev.map((t) => (t.uri === track.uri ? {
          ...t,
          cachedUri: offlineTrack.cachedUri,
          cachedArtwork: offlineTrack.cachedArtwork,
          artwork: offlineTrack.artwork,
        } : t))
      );
      return true;
    } catch (err: any) {
      setActiveDownloads((prev) => {
        const next = new Map(prev);
        next.delete(track.uri);
        return next;
      });
      OfflineCacheService.removeController(track.uri);
      if (err?.name === 'AbortError') {
        const partial = new File(Paths.document, `cache/navidrome/audio/${track.navidromeId}.mp3`);
        if (partial.exists) partial.delete();
        return false;
      }
      return false;
    }
  }, []);

  const cancelDownload = useCallback((uri: string) => {
    OfflineCacheService.cancelDownload(uri);
  }, []);

  const toggleFavorite = useCallback((uri: string) => {
    setLibrary((prev) =>
      prev.map((track) =>
        track.uri === uri ? { ...track, isFavorite: !track.isFavorite } : track
      )
    );
    setCurrentTrack((prev) =>
      prev?.uri === uri ? { ...prev, isFavorite: !prev.isFavorite } : prev
    );
  }, []);

  const batchToggleFavorite = useCallback((uris: string[]) => {
    setLibrary(prev => prev.map(track =>
      uris.includes(track.uri) ? { ...track, isFavorite: !track.isFavorite } : track
    ));
  }, []);

  const batchRemoveFromLibrary = useCallback((uris: string[]) => {
    setLibrary(prev => prev.filter(track => !uris.includes(track.uri)));
    setPlaylists(prev =>
      prev.map(playlist => ({
        ...playlist,
        tracks: playlist.tracks.filter(t => !uris.includes(t.uri)),
      }))
    );
    setQueue(prev => {
      const next = prev.filter(t => !uris.includes(t.uri));
      queueRef.current = next;
      return next;
    });
  }, []);

  const incrementPlayCount = useCallback((uri: string) => {
    setLibrary((prev) =>
      prev.map((track) =>
        track.uri === uri ? { ...track, playCount: (track.playCount || 0) + 1 } : track
      )
    );
  }, []);

  const playFromLibrary = useCallback(async (track: TrackMetadata) => {
    const trackIndex = library.findIndex((t) => t.uri === track.uri);
    const history = trackIndex >= 0 ? library.slice(0, trackIndex) : [];
    const queueTracks = trackIndex >= 0 ? library.slice(trackIndex + 1) : [];

    sourceTracksRef.current = library;
    historyRef.current = [...history, track];
    historyIndexRef.current = history.length;
    unstable_batchedUpdates(() => {
      setQueue(queueTracks);
      incrementPlayCount(track.uri);
    });

    await loadTrackInternal(track.uri, track, true);
  }, [library, incrementPlayCount, loadTrackInternal]);

  const createPlaylist = useCallback((name: string): string => {
    const id = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const newPlaylist: Playlist = {
      id,
      name,
      tracks: [],
      createdAt: Date.now(),
    };
    setPlaylists((prev) => [...prev, newPlaylist]);
    return id;
  }, []);

  const addTrackToPlaylist = useCallback((playlistId: string, track: TrackMetadata) => {
    setPlaylists((prev) =>
      prev.map((playlist) => {
        if (playlist.id !== playlistId) return playlist;
        if (playlist.tracks.some((t) => t.uri === track.uri)) return playlist;
        return { ...playlist, tracks: [...playlist.tracks, track] };
      })
    );
  }, []);

  const removeTrackFromPlaylist = useCallback((playlistId: string, trackUri: string) => {
    setPlaylists((prev) =>
      prev.map((playlist) =>
        playlist.id === playlistId
          ? { ...playlist, tracks: playlist.tracks.filter((t) => t.uri !== trackUri) }
          : playlist
      )
    );
  }, []);

  const reorderPlaylistTracks = useCallback((playlistId: string, fromIndex: number, toIndex: number) => {
    setPlaylists((prev) =>
      prev.map((playlist) => {
        if (playlist.id !== playlistId) return playlist;
        const tracks = [...playlist.tracks];
        const [moved] = tracks.splice(fromIndex, 1);
        tracks.splice(toIndex, 0, moved);
        return { ...playlist, tracks };
      })
    );
  }, []);

  const deletePlaylist = useCallback((playlistId: string) => {
    setPlaylists((prev) => prev.filter((playlist) => playlist.id !== playlistId));
  }, []);

  const renamePlaylist = useCallback((playlistId: string, newName: string) => {
    setPlaylists((prev) =>
      prev.map((playlist) =>
        playlist.id === playlistId ? { ...playlist, name: newName } : playlist
      )
    );
  }, []);

  const createSmartPlaylist = useCallback((name: string, rules: SmartPlaylistRule[], options?: { limit?: number; sortField?: 'playCount' | 'title'; sortDirection?: 'asc' | 'desc'; icon?: string }): string => {
    const id = `sp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const newSmartPlaylist: SmartPlaylist = {
      id,
      name,
      rules,
      limit: options?.limit,
      sortField: options?.sortField,
      sortDirection: options?.sortDirection,
      createdAt: Date.now(),
      icon: options?.icon,
    };
    setSmartPlaylists((prev) => [...prev, newSmartPlaylist]);
    return id;
  }, []);

  const updateSmartPlaylist = useCallback((id: string, updates: Partial<Omit<SmartPlaylist, 'id' | 'createdAt'>>) => {
    setSmartPlaylists((prev) =>
      prev.map((sp) =>
        sp.id === id ? { ...sp, ...updates } : sp
      )
    );
  }, []);

  const deleteSmartPlaylist = useCallback((id: string) => {
    setSmartPlaylists((prev) => prev.filter((sp) => sp.id !== id));
  }, []);

  const playPlaylist = useCallback(async (playlist: Playlist) => {
    if (playlist.tracks.length > 0) {
      const tracks = shuffleEnabledRef.current ? shuffleArray(playlist.tracks) : playlist.tracks;
      const firstTrack = tracks[0];
      const remainingTracks = tracks.slice(1);

      sourceTracksRef.current = tracks;
      historyRef.current = [firstTrack];
      historyIndexRef.current = 0;
      unstable_batchedUpdates(() => {
        setQueue(remainingTracks);
        incrementPlayCount(firstTrack.uri);
      });

      await loadTrackInternal(firstTrack.uri, firstTrack, true);
    }
  }, [incrementPlayCount, loadTrackInternal]);

  const playFromPlaylist = useCallback(async (playlist: Playlist, track: TrackMetadata) => {
    if (playlist.tracks.length === 0) return;

    const tracks = shuffleEnabledRef.current ? shuffleArray(playlist.tracks) : playlist.tracks;
    const trackIndex = tracks.findIndex((t) => t.uri === track.uri);
    if (trackIndex === -1) return;

    const history = tracks.slice(0, trackIndex);
    const queueTracks = tracks.slice(trackIndex + 1);

    sourceTracksRef.current = tracks;
    historyRef.current = [...history, track];
    historyIndexRef.current = history.length;
    unstable_batchedUpdates(() => {
      setQueue(queueTracks);
      incrementPlayCount(track.uri);
    });

    await loadTrackInternal(track.uri, track, true);
  }, [incrementPlayCount, loadTrackInternal]);

  const toggleShuffle = useCallback(() => {
    setShuffleEnabled((prev) => {
      const next = !prev;
      shuffleEnabledRef.current = next;
      if (next) {
        setQueue((prevQueue) => shuffleArray(prevQueue));
      }
      return next;
    });
  }, []);

  const toggleRepeat = useCallback(() => {
    setRepeatEnabled((prev) => {
      const next = !prev;
      repeatEnabledRef.current = next;
      return next;
    });
  }, []);

  const applyPreset = useCallback((preset: AudioPreset) => {
    const presets: Record<AudioPreset, { rate: number; vol: number }> = {
      flat: { rate: 1.0, vol: 1.0 },
      relaxed: { rate: 0.9, vol: 1.0 },
      clear: { rate: 1.0, vol: 0.85 },
      upbeat: { rate: 1.1, vol: 1.0 },
      quiet: { rate: 0.95, vol: 0.5 },
    };
    const p = presets[preset];
    setPlaybackRateState(p.rate);
    setVolumeState(p.vol);
    if (soundRef.current) {
      try {
        soundRef.current.setPlaybackRate(p.rate, 'high');
        soundRef.current.volume = p.vol;
      } catch {}
    }
  }, []);

  const setPlaybackRate = useCallback(async (rate: number) => {
    setPlaybackRateState(rate);
    setAudioPresetState('flat');
    if (soundRef.current) {
      try {
        soundRef.current.setPlaybackRate(rate, 'high');
      } catch {}
    }
  }, []);

  const setVolume = useCallback(async (vol: number) => {
    setVolumeState(vol);
    if (soundRef.current) {
      try {
        soundRef.current.volume = vol;
      } catch {}
    }
  }, []);

  const setAudioPreset = useCallback((preset: AudioPreset) => {
    setAudioPresetState(preset);
    applyPreset(preset);
  }, [applyPreset]);

  const setEqBandGain = useCallback(async (band: number, gain: number) => {
    setEqBandsState((prev) => {
      const next = [...prev];
      next[band] = gain;
      AsyncStorage.setItem('@coda_eq_bands', JSON.stringify(next));
      return next;
    });
    setEqPresetState(null);
    AsyncStorage.removeItem('@coda_eq_preset');
    try { await AudioEQ.setBandGain(band, gain); } catch {}
  }, []);

  const setEqPreset = useCallback(async (preset: EqPresetName) => {
    const bands = EQ_PRESETS[preset];
    setEqBandsState(bands);
    setEqPresetState(preset);
    AsyncStorage.setItem('@coda_eq_bands', JSON.stringify(bands));
    AsyncStorage.setItem('@coda_eq_preset', preset);
    for (let i = 0; i < bands.length; i++) {
      try { await AudioEQ.setBandGain(i, bands[i]); } catch {}
    }
  }, []);

  const setEqEnabled = useCallback(async (enabled: boolean) => {
    setEqEnabledState(enabled);
    AsyncStorage.setItem('@coda_eq_enabled', enabled.toString());
    try { await AudioEQ.setEnabled(enabled); } catch {}
  }, []);

  const setCrossfadeEnabled = useCallback((enabled: boolean) => {
    setCrossfadeEnabledState(enabled);
    crossfadeEnabledRef.current = enabled;
    AsyncStorage.setItem('@coda_crossfade_enabled', enabled.toString());
    if (!enabled && seamlessEnabledRef.current) {
      setSeamlessEnabledState(false);
      seamlessEnabledRef.current = false;
      AsyncStorage.removeItem('@coda_seamless_enabled');
    }
  }, []);

  const setCrossfadeDuration = useCallback((seconds: number) => {
    setCrossfadeDurationState(seconds);
    crossfadeDurationRef.current = seconds;
    AsyncStorage.setItem('@coda_crossfade_duration', seconds.toString());
    if (seconds !== 2 && seamlessEnabledRef.current) {
      setSeamlessEnabledState(false);
      seamlessEnabledRef.current = false;
      AsyncStorage.removeItem('@coda_seamless_enabled');
    }
  }, []);

  const setSeamlessEnabled = useCallback((enabled: boolean) => {
    setSeamlessEnabledState(enabled);
    seamlessEnabledRef.current = enabled;
    AsyncStorage.setItem('@coda_seamless_enabled', enabled.toString());
    if (enabled) {
      setCrossfadeEnabledState(true);
      crossfadeEnabledRef.current = true;
      AsyncStorage.setItem('@coda_crossfade_enabled', 'true');
      if (!crossfadeDurationRef.current) {
        setCrossfadeDurationState(2);
        crossfadeDurationRef.current = 2;
        AsyncStorage.setItem('@coda_crossfade_duration', '2');
      }
    }
  }, []);

  const FADE_DURATION = 30;

  const cancelSleepTimer = useCallback(() => {
    if (sleepTimerRef.current) {
      clearInterval(sleepTimerRef.current);
      sleepTimerRef.current = null;
    }
    if (fadeIntervalRef.current) {
      clearInterval(fadeIntervalRef.current);
      fadeIntervalRef.current = null;
    }
    if (isFadingRef.current) {
      isFadingRef.current = false;
      if (soundRef.current) {
        soundRef.current.volume = preFadeVolumeRef.current;
      }
    }
    setSleepTimerEnd(null);
    setSleepTimerRemaining(0);
    AsyncStorage.removeItem('@coda_sleep_timer_end');
  }, []);

  const setSleepTimer = useCallback((minutes: number) => {
    cancelSleepTimer();
    const endTime = Date.now() + minutes * 60 * 1000;
    setSleepTimerEnd(endTime);
    setSleepTimerRemaining(minutes * 60);
    AsyncStorage.setItem('@coda_sleep_timer_end', endTime.toString());

    sleepTimerRef.current = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((endTime - Date.now()) / 1000));
      setSleepTimerRemaining(remaining);

      if (remaining <= FADE_DURATION && !isFadingRef.current && remaining > 0 && soundRef.current) {
        isFadingRef.current = true;
        preFadeVolumeRef.current = volumeRef.current;
        fadeIntervalRef.current = setInterval(() => {
          const rem = Math.max(0, Math.ceil((endTime - Date.now()) / 1000));
          if (rem <= 0) {
            if (fadeIntervalRef.current) {
              clearInterval(fadeIntervalRef.current);
              fadeIntervalRef.current = null;
            }
            return;
          }
          const fraction = rem / FADE_DURATION;
          const newVol = preFadeVolumeRef.current * fraction;
          if (soundRef.current) soundRef.current.volume = Math.max(0, newVol);
        }, 500);
      }

      if (remaining <= 0) {
        cancelSleepTimer();
        if (soundRef.current) {
          soundRef.current.pause();
          setIsPlaying(false);
        }
      }
    }, 1000);
  }, [cancelSleepTimer]);

  const clearAllData = useCallback(async () => {
    await StorageService.clearAll();
    destroyPlayer(soundRef.current);
    soundRef.current = null;
    destroyPlayer(crossfadeSoundRef.current);
    crossfadeSoundRef.current = null;
    if (preloadRef.current) {
      try {
        preloadRef.current.clearLockScreenControls();
        preloadRef.current.remove();
      } catch {}
      preloadRef.current = null;
    }
    preloadedUriRef.current = null;
    crossfadeActiveRef.current = false;
    crossfadeStartedRef.current = false;
    if (crossfadeTimerRef.current) {
      clearInterval(crossfadeTimerRef.current);
      crossfadeTimerRef.current = null;
    }
    setCurrentTrack(null);
    setIsPlaying(false);
    setQueue([]);
    setLibrary([]);
    setPlaylists([]);
    setSmartPlaylists([]);
    setPlaybackPosition(0);
    setDuration(0);
    setShuffleEnabled(false);
    setRepeatEnabled(false);
    setAudioPresetState('flat');
    setPlaybackRateState(1.0);
    setVolumeState(1.0);
    setCrossfadeEnabledState(false);
    setCrossfadeDurationState(0);
    setSeamlessEnabledState(false);
    setEqEnabledState(true);
    setEqBandsState([0, 0, 0, 0, 0]);
    setEqPresetState('flat');
    historyRef.current = [];
    historyIndexRef.current = -1;
    sourceTracksRef.current = [];
    queueRef.current = [];
    repeatEnabledRef.current = false;
    shuffleEnabledRef.current = false;
    crossfadeEnabledRef.current = false;
    crossfadeDurationRef.current = 0;
    seamlessEnabledRef.current = false;
    cancelSleepTimer();
    await AsyncStorage.removeItem('@coda_crossfade_enabled');
    await AsyncStorage.removeItem('@coda_crossfade_duration');
    await AsyncStorage.removeItem('@coda_seamless_enabled');
    await AsyncStorage.removeItem('@coda_eq_enabled');
    await AsyncStorage.removeItem('@coda_eq_bands');
    await AsyncStorage.removeItem('@coda_eq_preset');
    await NavidromeService.clearCredentials();
    OfflineCacheService.clearCache();
    navidromeCredentialsRef.current = null;
    setNavidromeConnected(false);
    setNavidromeServerUrl('');
    LastFmService.clearCredentials().catch(() => {});
    lastFmCredsRef.current = null;
    lastFmConnectedRef.current = false;
    setLastFmConnected(false);
  }, [cancelSleepTimer]);

  const checkSleepTimerExpiry = useCallback(() => {
    if (!sleepTimerEnd) return;
    const remaining = Math.max(0, Math.ceil((sleepTimerEnd - Date.now()) / 1000));
    setSleepTimerRemaining(remaining);

    if (remaining <= FADE_DURATION && !isFadingRef.current && remaining > 0 && soundRef.current) {
      isFadingRef.current = true;
      preFadeVolumeRef.current = volumeRef.current;
      fadeIntervalRef.current = setInterval(() => {
        const rem = Math.max(0, Math.ceil((sleepTimerEnd - Date.now()) / 1000));
        if (rem <= 0) {
          if (fadeIntervalRef.current) {
            clearInterval(fadeIntervalRef.current);
            fadeIntervalRef.current = null;
          }
          return;
        }
        const fraction = rem / FADE_DURATION;
        const newVol = preFadeVolumeRef.current * fraction;
        if (soundRef.current) soundRef.current.volume = Math.max(0, newVol);
      }, 500);
    }

    if (remaining <= 0) {
      cancelSleepTimer();
      if (soundRef.current) {
        soundRef.current.pause();
        setIsPlaying(false);
      }
    }
  }, [sleepTimerEnd]);

  const checkSleepTimerExpiryRef = useRef(checkSleepTimerExpiry);
  checkSleepTimerExpiryRef.current = checkSleepTimerExpiry;

  const connectNavidrome = useCallback(async (url: string, username: string, password: string): Promise<{ ok: boolean; error?: string }> => {
    const result = await NavidromeService.ping(url, username, password);
    if (result.ok && result.creds) {
      await NavidromeService.saveCredentials(result.creds);
      navidromeCredentialsRef.current = result.creds;
      setNavidromeConnected(true);
      setNavidromeServerUrl(url);
    }
    return result;
  }, []);

  const disconnectNavidrome = useCallback(async () => {
    await NavidromeService.clearCredentials();
    navidromeCredentialsRef.current = null;
    setNavidromeConnected(false);
    setNavidromeServerUrl('');
  }, []);

  const getNavidromeCredentials = useCallback((): NavidromeCredentials | null => {
    return navidromeCredentialsRef.current;
  }, []);

  const connectLastFm = useCallback(async (apiKey: string, sharedSecret: string, token: string) => {
    try {
      const result = await LastFmService.getSession(token, apiKey, sharedSecret);
      const creds: LastFmCredentials = {
        apiKey,
        sharedSecret,
        sessionKey: result.sessionKey,
        username: result.username,
      };
      await LastFmService.saveCredentials(creds);
      lastFmCredsRef.current = creds;
      lastFmConnectedRef.current = true;
      setLastFmConnected(true);
      return { ok: true };
    } catch (err: any) {
      return { ok: false, error: err.message || 'Failed to connect to Last.fm' };
    }
  }, []);

  const disconnectLastFm = useCallback(async () => {
    await LastFmService.clearCredentials();
    lastFmCredsRef.current = null;
    lastFmConnectedRef.current = false;
    setLastFmConnected(false);
  }, []);

  const clearError = useCallback(() => setError(null), []);

  const value: AudioContextType = useMemo(() => ({
    currentTrack,
    isPlaying,
    queue,
    library,
    playlists,
    shuffleEnabled,
    repeatEnabled,
    playbackRate,
    volume,
    audioPreset,
    sleepTimerEnd,
    sleepTimerRemaining,
    navidromeConnected,
    navidromeServerUrl,
    loadTrack,
    play,
    pause,
    seekTo,
    skipNext,
    skipPrevious,
    removeFromQueue,
    addToQueue,
    playNextInQueue,
    reorderQueue,
    shuffleQueue,
    setQueue,
    toggleShuffle,
    toggleRepeat,
    addToLibrary,
    removeFromLibrary,
    downloadTrackForLibrary,
    playFromLibrary,
    playFromPlaylist,
    createPlaylist,
    addTrackToPlaylist,
    removeTrackFromPlaylist,
    reorderPlaylistTracks,
    deletePlaylist,
    renamePlaylist,
    playPlaylist,
    smartPlaylists,
    createSmartPlaylist,
    updateSmartPlaylist,
    deleteSmartPlaylist,
    setPlaybackRate,
    setVolume,
    setAudioPreset,
    eqEnabled,
    eqBands,
    eqPreset,
    setEqBandGain,
    setEqPreset,
    setEqEnabled,
    setSleepTimer,
    cancelSleepTimer,
    connectNavidrome,
    disconnectNavidrome,
    getNavidromeCredentials,
    crossfadeEnabled,
    crossfadeDuration,
    setCrossfadeEnabled,
    setCrossfadeDuration,
    seamlessEnabled,
    setSeamlessEnabled,
    clearAllData,
    lastFmConnected,
    connectLastFm,
    disconnectLastFm,
    toggleFavorite,
    batchToggleFavorite,
    batchRemoveFromLibrary,
    error,
    clearError,
    isLoading,
  }), [
    currentTrack, isPlaying, queue, library, playlists,
    shuffleEnabled, repeatEnabled,
    playbackRate, volume, audioPreset, sleepTimerEnd, sleepTimerRemaining,
    navidromeConnected, navidromeServerUrl, crossfadeEnabled, crossfadeDuration,
    seamlessEnabled,
    loadTrack, play, pause, seekTo, skipNext, skipPrevious,
    removeFromQueue, addToQueue, playNextInQueue, reorderQueue, shuffleQueue, setQueue,
    toggleShuffle, toggleRepeat, addToLibrary, removeFromLibrary, downloadTrackForLibrary,
    playFromLibrary, playFromPlaylist, createPlaylist, addTrackToPlaylist,
    removeTrackFromPlaylist, reorderPlaylistTracks, deletePlaylist,
    renamePlaylist, playPlaylist, smartPlaylists, createSmartPlaylist, updateSmartPlaylist, deleteSmartPlaylist,
    setPlaybackRate, setVolume, setAudioPreset,
    eqEnabled, eqBands, eqPreset, setEqBandGain, setEqPreset, setEqEnabled,
    setSleepTimer, cancelSleepTimer, connectNavidrome, disconnectNavidrome,
    getNavidromeCredentials, setCrossfadeEnabled, setCrossfadeDuration,
    setSeamlessEnabled, clearAllData,
    lastFmConnected, connectLastFm, disconnectLastFm, toggleFavorite,
    batchToggleFavorite, batchRemoveFromLibrary,
    error, clearError, isLoading,
  ]);

  const positionValue: PlaybackPositionType = useMemo(() => ({
    playbackPosition, duration,
  }), [playbackPosition, duration]);

  const downloadProgressValue: DownloadProgressType = useMemo(() => ({
    activeDownloads, cancelDownload,
  }), [activeDownloads, cancelDownload]);

  return (
    <AudioCtx.Provider value={value}>
      <PlaybackPositionCtx.Provider value={positionValue}>
        <DownloadProgressCtx.Provider value={downloadProgressValue}>
          {children}
        </DownloadProgressCtx.Provider>
      </PlaybackPositionCtx.Provider>
    </AudioCtx.Provider>
  );
}

export function useAudio() {
  const context = useContext(AudioCtx);
  if (context === undefined) {
    throw new Error('useAudio must be used within an AudioProvider');
  }
  return context;
}
