import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { Audio } from 'expo-av';
import { StorageService } from '../services/StorageService';

export interface TrackMetadata {
  title: string;
  artist: string;
  uri: string;
  duration?: number;
  artwork?: string;
}

export interface Playlist {
  id: string;
  name: string;
  tracks: TrackMetadata[];
  createdAt: number;
}

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
  createPlaylist: (name: string) => void;
  addTrackToPlaylist: (playlistId: string, track: TrackMetadata) => void;
  removeTrackFromPlaylist: (playlistId: string, trackUri: string) => void;
  deletePlaylist: (playlistId: string) => void;
  playPlaylist: (playlist: Playlist) => Promise<void>;
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

  const soundRef = useRef<Audio.Sound | null>(null);
  const playbackStatusRef = useRef<any>(null);
  const positionUpdateInterval = useRef<NodeJS.Timeout | null>(null);
  const repeatEnabledRef = useRef(false);
  const shuffleEnabledRef = useRef(false);
  const queueRef = useRef<TrackMetadata[]>([]);

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
      if (positionUpdateInterval.current) {
        clearInterval(positionUpdateInterval.current);
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
      if (savedCurrentTrack) setCurrentTrack(savedCurrentTrack);
      if (savedPlaybackPosition > 0) setPlaybackPosition(savedPlaybackPosition);
      if (savedQueue.length > 0) setQueue(savedQueue);
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

  useEffect(() => {
    if (isPlaying && soundRef.current) {
      positionUpdateInterval.current = setInterval(async () => {
        if (soundRef.current) {
          const status = await soundRef.current.getStatusAsync();
          if (status.isLoaded) {
            setPlaybackPosition(status.positionMillis || 0);
            setDuration(status.durationMillis || 0);
          }
        }
      }, 500);
    } else {
      if (positionUpdateInterval.current) {
        clearInterval(positionUpdateInterval.current);
        positionUpdateInterval.current = null;
      }
    }

    return () => {
      if (positionUpdateInterval.current) {
        clearInterval(positionUpdateInterval.current);
      }
    };
  }, [isPlaying]);

  const onPlaybackStatusUpdate = useCallback((status: any) => {
    playbackStatusRef.current = status;
    if (status.isLoaded) {
      setPlaybackPosition(status.positionMillis || 0);
      setDuration(status.durationMillis || 0);
      setIsPlaying(status.isPlaying);

      if (status.didJustFinish) {
        if (repeatEnabledRef.current) {
          soundRef.current?.setPositionAsync(0).then(() => {
            soundRef.current?.playAsync();
          });
        } else if (queueRef.current.length > 0) {
          const nextTrack = queueRef.current[0];
          const remainingQueue = queueRef.current.slice(1);
          setQueue(remainingQueue);
          loadTrackInternal(nextTrack.uri, nextTrack).then(() => {
            soundRef.current?.playAsync();
          });
        }
      }
    }
  }, []);

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
        await soundRef.current.setPositionAsync(position);
        setPlaybackPosition(position);
      } catch (error) {
        console.error('Error seeking:', error);
      }
    }
  };

  const skipNext = () => {
    if (queueRef.current.length > 0) {
      const nextTrack = queueRef.current[0];
      const remainingQueue = queueRef.current.slice(1);
      setQueue(remainingQueue);
      loadTrackInternal(nextTrack.uri, nextTrack).then(() => {
        soundRef.current?.playAsync();
      });
    }
  };

  const skipPrevious = () => {
    if (soundRef.current && currentTrack) {
      seekTo(0);
    }
  };

  const addToLibrary = (tracks: TrackMetadata[]) => {
    setLibrary((prev) => [...prev, ...tracks]);
  };

  const removeFromLibrary = (trackUri: string) => {
    setLibrary((prev) => prev.filter((track) => track.uri !== trackUri));
  };

  const playFromLibrary = async (track: TrackMetadata) => {
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

  const deletePlaylist = (playlistId: string) => {
    setPlaylists((prev) => prev.filter((playlist) => playlist.id !== playlistId));
  };

  const playPlaylist = async (playlist: Playlist) => {
    if (playlist.tracks.length > 0) {
      if (shuffleEnabledRef.current) {
        const shuffled = shuffleArray(playlist.tracks);
        setQueue(shuffled.slice(1));
        await loadTrackInternal(shuffled[0].uri, shuffled[0]);
      } else {
        setQueue(playlist.tracks.slice(1));
        await loadTrackInternal(playlist.tracks[0].uri, playlist.tracks[0]);
      }
      await play();
    }
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
    createPlaylist,
    addTrackToPlaylist,
    removeTrackFromPlaylist,
    deletePlaylist,
    playPlaylist,
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
