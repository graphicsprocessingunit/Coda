global.__DEV__ = true;

const storage = {};

jest.mock('expo-secure-store', () => ({
  setItemAsync: jest.fn(async (key, value) => { storage[key] = value; }),
  getItemAsync: jest.fn(async (key) => storage[key] ?? null),
  deleteItemAsync: jest.fn(async (key) => { delete storage[key]; }),
}));

jest.mock('@react-native-async-storage/async-storage', () => {
  const asyncStorage = {};
  return {
    __esModule: true,
    default: {
      setItem: jest.fn(async (key, value) => { asyncStorage[key] = value; }),
      getItem: jest.fn(async (key) => asyncStorage[key] ?? null),
      removeItem: jest.fn(async (key) => { delete asyncStorage[key]; }),
      clear: jest.fn(async () => { Object.keys(asyncStorage).forEach(k => delete asyncStorage[k]); }),
      multiRemove: jest.fn(async (keys) => { keys.forEach(k => delete asyncStorage[k]); }),
    },
  };
});

jest.mock('expo-audio', () => ({
  createAudioPlayer: jest.fn(() => ({
    play: jest.fn(),
    pause: jest.fn(),
    remove: jest.fn(),
    setCurrentTime: jest.fn(),
    setVolume: jest.fn(),
    setPlaybackRate: jest.fn(),
    setActiveForLockScreen: jest.fn(),
    currentStatus: jest.fn(() => ({ isLoaded: false, isPlaying: false, currentTime: 0, duration: 0 })),
    volume: 1,
    time: 0,
  })),
  setAudioModeAsync: jest.fn(),
}));

jest.mock('expo-file-system', () => ({
  File: jest.fn().mockImplementation(() => ({
    exists: false,
    uri: '',
    create: jest.fn(),
    delete: jest.fn(),
    write: jest.fn(),
    size: 0,
  })),
  Directory: jest.fn().mockImplementation(() => ({
    exists: false,
    create: jest.fn(),
    delete: jest.fn(),
    list: jest.fn(() => []),
  })),
  Paths: {
    document: { uri: 'file:///mock-documents' },
    cache: { uri: 'file:///mock-cache' },
  },
}));

jest.mock('expo-document-picker', () => ({
  getDocumentAsync: jest.fn(),
}));
