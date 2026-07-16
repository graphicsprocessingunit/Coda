import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { Audio } from 'expo-av';
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

export type AudioPreset = 'flat' | 'bass-boost' | 'vocal' | 'bright' | 'night';

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
  loadTrack: (trackUri: string, metadata: TrackMetadata) => Promise<void>;
  play: () => Promise<void>;
  pause: () => Promise<void>;
  seekTo: (position: number) => Promise<void>;
  skipNext: () => void;
  skipPrevious: () => void;
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
    return () => {
      if (soundRef.current) {
        soundRef.current.unloadAsync();
      }
      if (sleepTimerRef.current) {
        clearInterval(sleepTimerRef.current);
      }
    };
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

      if (savedCurrentTrack) {
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
    StorageService.savePlaybackPosition(playbackPosition);
  }, [playbackPosition]);

  useEffect(() => {
    if (queue.length > 0) {
      StorageService.saveQueue(queue);
    }
  }, [queue]);

  const loadTrackInternal = async (trackUri: string, metadata: TrackMetadata) => {
    if (soundRef.current) {
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

    soundRef.current = sound;
    setCurrentTrack(metadata);
    setPlaybackPosition(0);

    const status = await sound.getStatusAsync();
    if (status.isLoaded) {
      setDuration(status.durationMillis || 0);
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
      loadTrackInternal(nextTrack.uri, nextTrack).then(() => {
        soundRef.current?.playAsync();
      });
    } else if (sourceTracksRef.current.length > 0) {
      const tracks = sourceTracksRef.current;
      const firstTrack = tracks[0];
      const remainingTracks = tracks.slice(1);
      setQueue(remainingTracks);
      historyRef.current = [firstTrack];
      historyIndexRef.current = 0;
      loadTrackInternal(firstTrack.uri, firstTrack).then(() => {
        soundRef.current?.playAsync();
      });
    }
  }, []);

  const onPlaybackStatusUpdate = useCallback((status: any) => {
    playbackStatusRef.current = status;
    if (status.isLoaded) {
      if (!seekingRef.current) {
        setPlaybackPosition(status.positionMillis || 0);
      }
      setDuration(status.durationMillis || 0);
      setIsPlaying(status.isPlaying);

      if (status.didJustFinish) {
        if (repeatEnabledRef.current) {
          soundRef.current?.setPositionAsync(0).then(() => {
            soundRef.current?.playAsync();
          });
        } else {
          playNextFromQueue();
        }
      }
    }
  }, [playNextFromQueue]);

  const loadTrack = async (trackUri: string, metadata: TrackMetadata) => {
    try {
      await loadTrackInternal(trackUri, metadata);
    } catch (error) {
      console.error('Error loading track:', error);
    }
  };

  const play = async () => {
    if (soundRef.current) {
      try {
        const status = await soundRef.current.getStatusAsync();
        if (status.isLoaded) {
          await soundRef.current.playAsync();
          setIsPlaying(true);
        }
      } catch (error) {
        console.error('Error playing:', error);
      }
    }
  };

  const pause = async () => {
    if (soundRef.current) {
      try {
        await soundRef.current.pauseAsync();
        setIsPlaying(false);
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
      loadTrackInternal(track.uri, track).then(() => {
        soundRef.current?.playAsync();
      });
    } else {
      playNextFromQueue();
    }
  };

  const skipPrevious = () => {
    if (historyIndexRef.current > 0) {
      historyIndexRef.current -= 1;
      const track = historyRef.current[historyIndexRef.current];
      loadTrackInternal(track.uri, track).then(() => {
        soundRef.current?.playAsync();
      });
    } else if (soundRef.current) {
      seekTo(0);
    }
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

    await loadTrack(track.uri, track);
    await play();
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

  const playPlaylist = async (playlist: Playlist) => {
    if (playlist.tracks.length > 0) {
      const tracks = shuffleEnabledRef.current ? shuffleArray(playlist.tracks) : playlist.tracks;
      const firstTrack = tracks[0];
      const remainingTracks = tracks.slice(1);

      sourceTracksRef.current = tracks;
      historyRef.current = [firstTrack];
      historyIndexRef.current = 0;
      setQueue(remainingTracks);

      await loadTrackInternal(firstTrack.uri, firstTrack);
      await play();
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

    await loadTrackInternal(track.uri, track);
    await play();
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
      'bass-boost': { rate: 0.9, vol: 1.0 },
      vocal: { rate: 1.0, vol: 0.85 },
      bright: { rate: 1.1, vol: 1.0 },
      night: { rate: 0.95, vol: 0.5 },
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

  const cancelSleepTimer = () => {
    if (sleepTimerRef.current) {
      clearInterval(sleepTimerRef.current);
      sleepTimerRef.current = null;
    }
    setSleepTimerEnd(null);
    setSleepTimerRemaining(0);
  };

  const setSleepTimer = (minutes: number) => {
    cancelSleepTimer();
    const endTime = Date.now() + minutes * 60 * 1000;
    setSleepTimerEnd(endTime);
    setSleepTimerRemaining(minutes * 60);

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
    playPlaylist,
    setPlaybackRate,
    setVolume,
    setAudioPreset,
    setSleepTimer,
    cancelSleepTimer,
    connectNavidrome,
    disconnectNavidrome,
    getNavidromeCredentials,
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
