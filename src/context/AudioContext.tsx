import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { Audio } from 'expo-av';
import { AppState, AppStateStatus } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StorageService } from '../services/StorageService';
import { NavidromeService, NavidromeCredentials } from '../services/NavidromeService';

export interface TrackMetadata {
  title: string;
  artist: string;
  uri: string;
  duration?: number;
  artwork?: string;
  source?: 'local' | 'navidrome';
  navidromeId?: string;
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
  clearAllData: () => void;
}

const AudioContext = createContext<AudioContextType | undefined>(undefined);

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
  const [navidromeConnected, setNavidromeConnected] = useState(false);
  const [navidromeServerUrl, setNavidromeServerUrl] = useState('');
  const navidromeCredentialsRef = useRef<NavidromeCredentials | null>(null);

  const soundRef = useRef<Audio.Sound | null>(null);
  const playbackStatusRef = useRef<any>(null);
  const repeatEnabledRef = useRef(false);
  const shuffleEnabledRef = useRef(false);
  const queueRef = useRef<TrackMetadata[]>([]);
  const historyRef = useRef<TrackMetadata[]>([]);
  const historyIndexRef = useRef(-1);
  const seekingRef = useRef(false);
  const sourceTracksRef = useRef<TrackMetadata[]>([]);
  const sleepTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const positionSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedPositionRef = useRef(0);
  const loadGenerationRef = useRef(0);
  const crossfadeSoundRef = useRef<Audio.Sound | null>(null);
  const crossfadeActiveRef = useRef(false);
  const crossfadeStartedRef = useRef(false);
  const crossfadeTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const crossfadeEnabledRef = useRef(false);
  const crossfadeDurationRef = useRef(0);
  const volumeRef = useRef(1.0);

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
    volumeRef.current = volume;
  }, [volume]);

  useEffect(() => {
    return () => {
      if (soundRef.current) {
        soundRef.current.unloadAsync();
      }
      if (crossfadeSoundRef.current) {
        crossfadeSoundRef.current.unloadAsync();
      }
      if (sleepTimerRef.current) {
        clearInterval(sleepTimerRef.current);
      }
      if (positionSaveTimerRef.current) {
        clearTimeout(positionSaveTimerRef.current);
      }
      if (crossfadeTimerRef.current) {
        clearInterval(crossfadeTimerRef.current);
      }
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

      if (savedCurrentTrack && savedCurrentTrack.source !== 'navidrome') {
        setCurrentTrack(savedCurrentTrack);
        try {
          await Audio.setAudioModeAsync({
            playsInSilentModeIOS: true,
            staysActiveInBackground: true,
            shouldDuckAndroid: true,
          });
          const { sound } = await Audio.Sound.createAsync(
            { uri: savedCurrentTrack.uri },
            { shouldPlay: false, progressUpdateIntervalMillis: 500 },
            onPlaybackStatusUpdate
          );
          soundRef.current = sound;
          if (savedPlaybackPosition > 0) {
            await sound.setPositionAsync(savedPlaybackPosition);
          }
          const status = await sound.getStatusAsync();
          if (status.isLoaded) {
            setDuration(status.durationMillis || 0);
          }
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
                soundRef.current.pauseAsync().then(() => setIsPlaying(false));
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
    };

    loadSavedData();
  }, []);

  useEffect(() => {
    if (library.length > 0) {
      StorageService.saveLibrary(library);
    }
  }, [library]);

  useEffect(() => {
    if (playlists.length > 0) {
      StorageService.savePlaylists(playlists);
    }
  }, [playlists]);

  useEffect(() => {
    if (currentTrack) {
      StorageService.saveCurrentTrack(currentTrack);
    }
  }, [currentTrack]);

  useEffect(() => {
    if (queue.length > 0) {
      StorageService.saveQueue(queue);
    }
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
        try { await crossfadeSoundRef.current.unloadAsync(); } catch {}
        crossfadeSoundRef.current = null;
      }
    }

    if (soundRef.current) {
      const prevStatus = await soundRef.current.getStatusAsync();
      if (prevStatus.isLoaded) {
        savePositionImmediate(prevStatus.positionMillis || 0);
      }
      await soundRef.current.unloadAsync();
    }

    await Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      staysActiveInBackground: true,
      shouldDuckAndroid: true,
    });

    const { sound } = await Audio.Sound.createAsync(
      { uri: trackUri },
      {
        shouldPlay: false,
        progressUpdateIntervalMillis: 500,
      },
      onPlaybackStatusUpdate
    );

    if (generation !== loadGenerationRef.current) {
      await sound.unloadAsync();
      return;
    }

    soundRef.current = sound;
    setCurrentTrack(metadata);
    setPlaybackPosition(0);

    const status = await sound.getStatusAsync();
    if (status.isLoaded) {
      setDuration(status.durationMillis || 0);
    }

    if (autoPlay) {
      await sound.playAsync();
      setIsPlaying(true);
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
      loadTrackInternal(nextTrack.uri, nextTrack, true);
    } else if (sourceTracksRef.current.length > 0) {
      const tracks = sourceTracksRef.current;
      const firstTrack = tracks[0];
      const remainingTracks = tracks.slice(1);
      setQueue(remainingTracks);
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
      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri: nextTrack.uri },
        { shouldPlay: false, progressUpdateIntervalMillis: 500 },
        onPlaybackStatusUpdate
      );

      if (!crossfadeActiveRef.current) {
        await newSound.unloadAsync();
        return;
      }

      await newSound.setVolumeAsync(0);
      await newSound.playAsync();

      crossfadeTimerRef.current = setInterval(async () => {
        step++;
        const oldVol = Math.max(0, currentVol * (1 - step / steps));
        const newVol = Math.min(currentVol, currentVol * (step / steps));

        try {
          if (soundRef.current) await soundRef.current.setVolumeAsync(oldVol);
          await newSound.setVolumeAsync(newVol);
        } catch {}

        if (step >= steps) {
          if (crossfadeTimerRef.current) {
            clearInterval(crossfadeTimerRef.current);
            crossfadeTimerRef.current = null;
          }

          try {
            const oldSound = soundRef.current;
            if (oldSound) {
              const oldStatus = await oldSound.getStatusAsync();
              if (oldStatus.isLoaded) {
                savePositionImmediate(oldStatus.positionMillis || 0);
              }
              await oldSound.unloadAsync();
            }
          } catch {}

          soundRef.current = newSound;

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

          setCurrentTrack(nextTrack);
          setPlaybackPosition(0);

          const newStatus = await newSound.getStatusAsync();
          if (newStatus.isLoaded) {
            setDuration(newStatus.durationMillis || 0);
          }

          crossfadeActiveRef.current = false;
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
      if (!seekingRef.current) {
        setPlaybackPosition(status.positionMillis || 0);
        debouncedSavePosition(status.positionMillis || 0);
      }
      setDuration(status.durationMillis || 0);
      setIsPlaying(status.isPlaying);

      if (status.didJustFinish) {
        if (crossfadeActiveRef.current) {
          return;
        }
        if (repeatEnabledRef.current) {
          soundRef.current?.setPositionAsync(0).then(() => {
            soundRef.current?.playAsync();
          });
        } else {
          playNextFromQueue();
        }
      }

      if (crossfadeEnabledRef.current && crossfadeDurationRef.current > 0 && !repeatEnabledRef.current && !crossfadeActiveRef.current && !crossfadeStartedRef.current) {
        const remaining = (status.durationMillis || 0) - (status.positionMillis || 0);
        if (remaining <= crossfadeDurationRef.current * 1000 + 500 && remaining > 0) {
          startCrossfade();
        }
      }
    }
  }, [playNextFromQueue, startCrossfade]);

  const loadTrack = async (trackUri: string, metadata: TrackMetadata, autoPlay = false) => {
    try {
      await loadTrackInternal(trackUri, metadata, autoPlay);
    } catch (error) {
      console.error('Error loading track:', error);
    }
  };

  const play = async () => {
    if (!soundRef.current) return;
    try {
      const status = await soundRef.current.getStatusAsync();
      if (status.isLoaded) {
        await soundRef.current.playAsync();
        setIsPlaying(true);
      }
    } catch (error) {
      console.error('Error playing:', error);
    }
  };

  const pause = async () => {
    if (soundRef.current) {
      try {
        await soundRef.current.pauseAsync();
        setIsPlaying(false);
        const status = await soundRef.current.getStatusAsync();
        if (status.isLoaded) {
          savePositionImmediate(status.positionMillis || 0);
        }
      } catch (error) {
        console.error('Error pausing:', error);
      }
    }
  };

  const seekTo = async (position: number) => {
    if (soundRef.current) {
      try {
        seekingRef.current = true;
        await soundRef.current.setPositionAsync(position);
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
  };

  const skipNext = () => {
    if (historyIndexRef.current < historyRef.current.length - 1) {
      historyIndexRef.current += 1;
      const track = historyRef.current[historyIndexRef.current];
      loadTrackInternal(track.uri, track, true);
    } else {
      playNextFromQueue();
    }
  };

  const skipPrevious = () => {
    if (historyIndexRef.current > 0) {
      historyIndexRef.current -= 1;
      const track = historyRef.current[historyIndexRef.current];
      loadTrackInternal(track.uri, track, true);
    } else if (soundRef.current) {
      seekTo(0);
    }
  };

  const removeFromQueue = (index: number) => {
    setQueue((prev) => prev.filter((_, i) => i !== index));
  };

  const addToQueue = (track: TrackMetadata) => {
    setQueue((prev) => [...prev, track]);
  };

  const playNextInQueue = (track: TrackMetadata) => {
    setQueue((prev) => [track, ...prev]);
  };

  const reorderQueue = (fromIndex: number, toIndex: number) => {
    setQueue((prev) => {
      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
  };

  const addToLibrary = (tracks: TrackMetadata[]) => {
    setLibrary((prev) => [...prev, ...tracks]);
  };

  const removeFromLibrary = (trackUri: string) => {
    setLibrary((prev) => prev.filter((track) => track.uri !== trackUri));
    setPlaylists((prev) =>
      prev.map((playlist) => ({
        ...playlist,
        tracks: playlist.tracks.filter((t) => t.uri !== trackUri),
      }))
    );
  };

  const playFromLibrary = async (track: TrackMetadata) => {
    const trackIndex = library.findIndex((t) => t.uri === track.uri);
    const history = trackIndex >= 0 ? library.slice(0, trackIndex) : [];
    const queueTracks = trackIndex >= 0 ? library.slice(trackIndex + 1) : [];

    sourceTracksRef.current = library;
    historyRef.current = [...history, track];
    historyIndexRef.current = history.length;
    setQueue(queueTracks);

    await loadTrackInternal(track.uri, track, true);
  };

  const createPlaylist = (name: string) => {
    const newPlaylist: Playlist = {
      id: Date.now().toString(),
      name,
      tracks: [],
      createdAt: Date.now(),
    };
    setPlaylists((prev) => [...prev, newPlaylist]);
  };

  const addTrackToPlaylist = (playlistId: string, track: TrackMetadata) => {
    setPlaylists((prev) =>
      prev.map((playlist) => {
        if (playlist.id !== playlistId) return playlist;
        if (playlist.tracks.some((t) => t.uri === track.uri)) return playlist;
        return { ...playlist, tracks: [...playlist.tracks, track] };
      })
    );
  };

  const removeTrackFromPlaylist = (playlistId: string, trackUri: string) => {
    setPlaylists((prev) =>
      prev.map((playlist) =>
        playlist.id === playlistId
          ? { ...playlist, tracks: playlist.tracks.filter((t) => t.uri !== trackUri) }
          : playlist
      )
    );
  };

  const reorderPlaylistTracks = (playlistId: string, fromIndex: number, toIndex: number) => {
    setPlaylists((prev) =>
      prev.map((playlist) => {
        if (playlist.id !== playlistId) return playlist;
        const tracks = [...playlist.tracks];
        const [moved] = tracks.splice(fromIndex, 1);
        tracks.splice(toIndex, 0, moved);
        return { ...playlist, tracks };
      })
    );
  };

  const deletePlaylist = (playlistId: string) => {
    setPlaylists((prev) => prev.filter((playlist) => playlist.id !== playlistId));
  };

  const renamePlaylist = (playlistId: string, newName: string) => {
    setPlaylists((prev) =>
      prev.map((playlist) =>
        playlist.id === playlistId ? { ...playlist, name: newName } : playlist
      )
    );
  };

  const playPlaylist = async (playlist: Playlist) => {
    if (playlist.tracks.length > 0) {
      const tracks = shuffleEnabledRef.current ? shuffleArray(playlist.tracks) : playlist.tracks;
      const firstTrack = tracks[0];
      const remainingTracks = tracks.slice(1);

      sourceTracksRef.current = tracks;
      historyRef.current = [firstTrack];
      historyIndexRef.current = 0;
      setQueue(remainingTracks);

      await loadTrackInternal(firstTrack.uri, firstTrack, true);
    }
  };

  const playFromPlaylist = async (playlist: Playlist, track: TrackMetadata) => {
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

    await loadTrackInternal(track.uri, track, true);
  };

  const toggleShuffle = () => {
    setShuffleEnabled((prev) => {
      const next = !prev;
      shuffleEnabledRef.current = next;
      if (next) {
        setQueue((prevQueue) => shuffleArray(prevQueue));
      }
      return next;
    });
  };

  const toggleRepeat = () => {
    setRepeatEnabled((prev) => {
      const next = !prev;
      repeatEnabledRef.current = next;
      return next;
    });
  };

  const applyPreset = async (preset: AudioPreset) => {
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
        const status = await soundRef.current.getStatusAsync();
        if (status.isLoaded) {
          await soundRef.current.setRateAsync(p.rate, true);
          await soundRef.current.setVolumeAsync(p.vol);
        }
      } catch {}
    }
  };

  const setPlaybackRate = async (rate: number) => {
    setPlaybackRateState(rate);
    setAudioPresetState('flat');
    if (soundRef.current) {
      try {
        const status = await soundRef.current.getStatusAsync();
        if (status.isLoaded) {
          await soundRef.current.setRateAsync(rate, true);
        }
      } catch {}
    }
  };

  const setVolume = async (vol: number) => {
    setVolumeState(vol);
    if (soundRef.current) {
      try {
        const status = await soundRef.current.getStatusAsync();
        if (status.isLoaded) {
          await soundRef.current.setVolumeAsync(vol);
        }
      } catch {}
    }
  };

  const setAudioPreset = (preset: AudioPreset) => {
    setAudioPresetState(preset);
    applyPreset(preset);
  };

  const setCrossfadeEnabled = (enabled: boolean) => {
    setCrossfadeEnabledState(enabled);
    crossfadeEnabledRef.current = enabled;
    AsyncStorage.setItem('@coda_crossfade_enabled', enabled.toString());
  };

  const setCrossfadeDuration = (seconds: number) => {
    setCrossfadeDurationState(seconds);
    crossfadeDurationRef.current = seconds;
    AsyncStorage.setItem('@coda_crossfade_duration', seconds.toString());
  };

  const clearAllData = () => {
    if (soundRef.current) {
      soundRef.current.unloadAsync();
      soundRef.current = null;
    }
    if (crossfadeSoundRef.current) {
      crossfadeSoundRef.current.unloadAsync();
      crossfadeSoundRef.current = null;
    }
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
    historyRef.current = [];
    historyIndexRef.current = -1;
    sourceTracksRef.current = [];
    queueRef.current = [];
    repeatEnabledRef.current = false;
    shuffleEnabledRef.current = false;
    crossfadeEnabledRef.current = false;
    crossfadeDurationRef.current = 0;
    cancelSleepTimer();
  };

  const cancelSleepTimer = () => {
    if (sleepTimerRef.current) {
      clearInterval(sleepTimerRef.current);
      sleepTimerRef.current = null;
    }
    setSleepTimerEnd(null);
    setSleepTimerRemaining(0);
    AsyncStorage.removeItem('@coda_sleep_timer_end');
  };

  const setSleepTimer = (minutes: number) => {
    cancelSleepTimer();
    const endTime = Date.now() + minutes * 60 * 1000;
    setSleepTimerEnd(endTime);
    setSleepTimerRemaining(minutes * 60);
    AsyncStorage.setItem('@coda_sleep_timer_end', endTime.toString());

    sleepTimerRef.current = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((endTime - Date.now()) / 1000));
      setSleepTimerRemaining(remaining);
      if (remaining <= 0) {
        cancelSleepTimer();
        if (soundRef.current) {
          soundRef.current.pauseAsync().then(() => setIsPlaying(false));
        }
      }
    }, 1000);
  };

  const checkSleepTimerExpiry = useCallback(() => {
    if (!sleepTimerEnd) return;
    const remaining = Math.max(0, Math.ceil((sleepTimerEnd - Date.now()) / 1000));
    setSleepTimerRemaining(remaining);
    if (remaining <= 0) {
      cancelSleepTimer();
      if (soundRef.current) {
        soundRef.current.pauseAsync().then(() => setIsPlaying(false));
      }
    }
  }, [sleepTimerEnd]);

  const checkSleepTimerExpiryRef = useRef(checkSleepTimerExpiry);
  checkSleepTimerExpiryRef.current = checkSleepTimerExpiry;

  const connectNavidrome = async (url: string, username: string, password: string): Promise<{ ok: boolean; error?: string }> => {
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
  };

  const disconnectNavidrome = async () => {
    await NavidromeService.clearCredentials();
    navidromeCredentialsRef.current = null;
    setNavidromeConnected(false);
    setNavidromeServerUrl('');
  };

  const getNavidromeCredentials = (): NavidromeCredentials | null => {
    return navidromeCredentialsRef.current;
  };

  const value: AudioContextType = {
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
    clearAllData,
  };

  return <AudioContext.Provider value={value}>{children}</AudioContext.Provider>;
}

export function useAudio() {
  const context = useContext(AudioContext);
  if (context === undefined) {
    throw new Error('useAudio must be used within an AudioProvider');
  }
  return context;
}

export { SAMPLE_TRACK };
