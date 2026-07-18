import React, { createContext, useContext, useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import type { AudioPlayer } from 'expo-audio';
import { AppState, AppStateStatus } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StorageService } from '../services/StorageService';
import { NavidromeService, NavidromeCredentials } from '../services/NavidromeService';
import { OfflineCacheService } from '../services/OfflineCacheService';
import { loadDemoContent } from '../services/DemoDataService';

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

export type AudioPreset = 'flat' | 'relaxed' | 'clear' | 'upbeat' | 'quiet';

interface AudioContextType {
  currentTrack: TrackMetadata | null;
  isPlaying: boolean;
  queue: TrackMetadata[];
  library: TrackMetadata[];
  playlists: Playlist[];
  playbackPosition: number;
  duration: number;
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
  setQueue: (tracks: TrackMetadata[]) => void;
  toggleShuffle: () => void;
  toggleRepeat: () => void;
  addToLibrary: (tracks: TrackMetadata[]) => void;
  removeFromLibrary: (trackUri: string) => void;
  playFromLibrary: (track: TrackMetadata) => Promise<void>;
  playFromPlaylist: (playlist: Playlist, track: TrackMetadata) => Promise<void>;
  createPlaylist: (name: string) => void;
  addTrackToPlaylist: (playlistId: string, track: TrackMetadata) => void;
  removeTrackFromPlaylist: (playlistId: string, trackUri: string) => void;
  reorderPlaylistTracks: (playlistId: string, fromIndex: number, toIndex: number) => void;
  deletePlaylist: (playlistId: string) => void;
  renamePlaylist: (playlistId: string, newName: string) => void;
  playPlaylist: (playlist: Playlist) => Promise<void>;
  setPlaybackRate: (rate: number) => Promise<void>;
  setVolume: (vol: number) => Promise<void>;
  setAudioPreset: (preset: AudioPreset) => void;
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
  toggleFavorite: (uri: string) => void;
  loadDemoData: () => Promise<void>;
  error: string | null;
  clearError: () => void;
  isLoading: boolean;
}

const AudioCtx = createContext<AudioContextType | undefined>(undefined);

const SAMPLE_TRACK: TrackMetadata = {
  title: 'Test Track',
  artist: 'Coda Player',
  uri: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
  artwork: 'https://picsum.photos/400/400?random=1',
};

function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function generateSalt(): string {
  const chars = 'abcdef0123456789';
  let salt = '';
  for (let i = 0; i < 16; i++) {
    salt += chars[Math.floor(Math.random() * chars.length)];
  }
  return salt;
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
  const [sleepTimerEnd, setSleepTimerEnd] = useState<number | null>(null);
  const [sleepTimerRemaining, setSleepTimerRemaining] = useState(0);
  const [crossfadeEnabled, setCrossfadeEnabledState] = useState(false);
  const [crossfadeDuration, setCrossfadeDurationState] = useState(0);
  const [seamlessEnabled, setSeamlessEnabledState] = useState(false);
  const [navidromeConnected, setNavidromeConnected] = useState(false);
  const [navidromeServerUrl, setNavidromeServerUrl] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const navidromeCredentialsRef = useRef<NavidromeCredentials | null>(null);

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

      if (savedLibrary.length > 0) setLibrary(savedLibrary);
      if (savedPlaylists.length > 0) setPlaylists(savedPlaylists);
      if (savedQueue.length > 0) setQueue(savedQueue);

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

      isLoadedRef.current = true;
      setIsLoading(false);
    };

    loadSavedData();
  }, []);

  useEffect(() => {
    if (!isLoadedRef.current) return;
    StorageService.saveLibrary(library);
  }, [library]);

  useEffect(() => {
    if (!isLoadedRef.current) return;
    StorageService.savePlaylists(playlists);
  }, [playlists]);

  useEffect(() => {
    if (currentTrack) {
      StorageService.saveCurrentTrack(currentTrack);
    }
  }, [currentTrack]);

  useEffect(() => {
    if (!isLoadedRef.current) return;
    StorageService.saveQueue(queue);
  }, [queue]);

  const loadTrackInternal = async (trackUri: string, metadata: TrackMetadata, autoPlay = false) => {
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
    setCurrentTrack({ ...metadata, isFavorite: libMatch?.isFavorite ?? metadata.isFavorite ?? false });
    setPlaybackPosition(0);

    const status = player.currentStatus;
    if (status.isLoaded) {
      setDuration((status.duration || 0) * 1000);
    }
    setIsPlaying(autoPlay);

    updateLockScreen(player, metadata);

    if (autoPlay) {
      setTimeout(() => preloadNextTrack(), 100);
    }
  };

  const playNextFromQueue = useCallback(() => {
    const currentQueue = queueRef.current;
    if (currentQueue.length > 0) {
      const nextTrack = currentQueue[0];
      const remainingQueue = currentQueue.slice(1);
      setQueue(remainingQueue);
      historyRef.current.push(nextTrack);
      historyIndexRef.current = historyRef.current.length - 1;
      incrementPlayCount(nextTrack.uri);
      loadTrackInternal(nextTrack.uri, nextTrack, true);
    } else if (sourceTracksRef.current.length > 0) {
      const tracks = sourceTracksRef.current;
      const firstTrack = tracks[0];
      const remainingTracks = tracks.slice(1);
      setQueue(remainingTracks);
      historyRef.current = [firstTrack];
      historyIndexRef.current = 0;
      incrementPlayCount(firstTrack.uri);
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
            historyRef.current = [tracks[0]];
            historyIndexRef.current = 0;
            setQueue(tracks.slice(1));
          }

          const libMatch = libraryRef.current.find(t => t.uri === nextTrack.uri);
          setCurrentTrack({ ...nextTrack, isFavorite: libMatch?.isFavorite ?? nextTrack.isFavorite ?? false });
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

      if (!seekingRef.current) {
        setPlaybackPosition(positionMs);
        debouncedSavePosition(positionMs);
      }
      setDuration(durationMs);
      setIsPlaying(status.playing);

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
    setQueue(queueTracks);
    incrementPlayCount(track.uri);

    await loadTrackInternal(track.uri, track, true);
  }, [library, incrementPlayCount, loadTrackInternal]);

  const createPlaylist = useCallback((name: string) => {
    const newPlaylist: Playlist = {
      id: Date.now().toString(),
      name,
      tracks: [],
      createdAt: Date.now(),
    };
    setPlaylists((prev) => [...prev, newPlaylist]);
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

  const playPlaylist = useCallback(async (playlist: Playlist) => {
    if (playlist.tracks.length > 0) {
      const tracks = shuffleEnabledRef.current ? shuffleArray(playlist.tracks) : playlist.tracks;
      const firstTrack = tracks[0];
      const remainingTracks = tracks.slice(1);

      sourceTracksRef.current = tracks;
      historyRef.current = [firstTrack];
      historyIndexRef.current = 0;
      setQueue(remainingTracks);
      incrementPlayCount(firstTrack.uri);

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
    setQueue(queueTracks);
    incrementPlayCount(track.uri);

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
        }, 100);
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
    await NavidromeService.clearCredentials();
    OfflineCacheService.clearCache();
    navidromeCredentialsRef.current = null;
    setNavidromeConnected(false);
    setNavidromeServerUrl('');
  }, [cancelSleepTimer]);

  const loadDemoData = useCallback(async () => {
    await loadDemoContent(setLibrary);
  }, []);

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
      }, 100);
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
    if (result.ok) {
      const salt = generateSalt();
      const token = NavidromeService.createToken(password, salt);
      const creds: NavidromeCredentials = { url, username, token, salt };
      await NavidromeService.saveCredentials(creds);
      navidromeCredentialsRef.current = creds;
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

  const clearError = useCallback(() => setError(null), []);

  const value: AudioContextType = useMemo(() => ({
    currentTrack,
    isPlaying,
    queue,
    library,
    playlists,
    playbackPosition,
    duration,
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
    setQueue,
    toggleShuffle,
    toggleRepeat,
    addToLibrary,
    removeFromLibrary,
    playFromLibrary,
    playFromPlaylist,
    createPlaylist,
    addTrackToPlaylist,
    removeTrackFromPlaylist,
    reorderPlaylistTracks,
    deletePlaylist,
    renamePlaylist,
    playPlaylist,
    setPlaybackRate,
    setVolume,
    setAudioPreset,
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
    toggleFavorite,
    loadDemoData,
    error,
    clearError,
    isLoading,
  }), [
    currentTrack, isPlaying, queue, library, playlists,
    playbackPosition, duration, shuffleEnabled, repeatEnabled,
    playbackRate, volume, audioPreset, sleepTimerEnd, sleepTimerRemaining,
    navidromeConnected, navidromeServerUrl, crossfadeEnabled, crossfadeDuration,
    seamlessEnabled,
    loadTrack, play, pause, seekTo, skipNext, skipPrevious,
    removeFromQueue, addToQueue, playNextInQueue, reorderQueue, setQueue,
    toggleShuffle, toggleRepeat, addToLibrary, removeFromLibrary,
    playFromLibrary, playFromPlaylist, createPlaylist, addTrackToPlaylist,
    removeTrackFromPlaylist, reorderPlaylistTracks, deletePlaylist,
    renamePlaylist, playPlaylist, setPlaybackRate, setVolume, setAudioPreset,
    setSleepTimer, cancelSleepTimer, connectNavidrome, disconnectNavidrome,
    getNavidromeCredentials, setCrossfadeEnabled, setCrossfadeDuration,
    setSeamlessEnabled, clearAllData, toggleFavorite, loadDemoData,
    error, clearError, isLoading,
  ]);

  return <AudioCtx.Provider value={value}>{children}</AudioCtx.Provider>;
}

export function useAudio() {
  const context = useContext(AudioCtx);
  if (context === undefined) {
    throw new Error('useAudio must be used within an AudioProvider');
  }
  return context;
}

export { SAMPLE_TRACK };
