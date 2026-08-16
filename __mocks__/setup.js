global.__DEV__ = true;

const storage = {};

jest.mock('expo-secure-store', () => ({
  setItemAsync: jest.fn(async (key, value) => { storage[key] = value; }),
  getItemAsync: jest.fn(async (key) => storage[key] ?? null),
  deleteItemAsync: jest.fn(async (key) => { delete storage[key]; }),
}));

jest.mock('expo-crypto', () => {
  let counter = 0;
  const getRandomBytes = jest.fn((byteLength) => {
    const bytes = new Uint8Array(byteLength);
    for (let i = 0; i < byteLength; i++) {
      bytes[i] = (counter + i) % 256;
      counter++;
    }
    return bytes;
  });
  return {
    getRandomBytes,
    getRandomBytesAsync: jest.fn(async (byteLength) => getRandomBytes(byteLength)),
  };
});

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

jest.mock('expo-file-system', () => {
  const ROOT_URI = 'file:///mock-documents';
  const CACHE_URI = 'file:///mock-cache';

  const files = new Map();
  const dirs = new Set([ROOT_URI, CACHE_URI]);

  function join(...parts) {
    return parts
      .map((p) => (p && typeof p === 'object' && 'uri' in p ? p.uri : String(p)))
      .join('/');
  }

  function nameOf(uri) {
    return uri.substring(uri.lastIndexOf('/') + 1);
  }

  function extensionOf(uri) {
    const name = nameOf(uri);
    const idx = name.lastIndexOf('.');
    return idx >= 0 ? name.substring(idx) : '';
  }

  function parentUri(uri) {
    const idx = uri.lastIndexOf('/');
    return idx > 0 ? uri.substring(0, idx) : uri;
  }

  function childrenOf(dirUri) {
    const prefix = dirUri.endsWith('/') ? dirUri : dirUri + '/';
    const uris = [];
    const seen = new Set();
    for (const uri of [...dirs, ...files.keys()]) {
      if (uri.startsWith(prefix)) {
        const rest = uri.substring(prefix.length);
        if (rest && !rest.includes('/') && !seen.has(uri)) {
          seen.add(uri);
          uris.push(uri);
        }
      }
    }
    return uris;
  }

  function ensureParentDirs(uri) {
    const parent = parentUri(uri);
    if (parent && parent !== uri && !dirs.has(parent)) {
      ensureParentDirs(parent);
      dirs.add(parent);
    }
  }

  class Directory {
    constructor(...parts) {
      this._uri = join(...parts);
    }
    get uri() { return this._uri; }
    get name() { return nameOf(this._uri); }
    get exists() { return dirs.has(this._uri); }
    create({ intermediates = false } = {}) {
      if (this.exists) return;
      if (intermediates) ensureParentDirs(this._uri);
      dirs.add(this._uri);
    }
    delete() { dirs.delete(this._uri); }
    list() {
      if (!this.exists) return [];
      return childrenOf(this._uri).map((uri) =>
        dirs.has(uri) ? new Directory(uri) : new File(uri),
      );
    }
    move(destination) {
      const destUri = typeof destination === 'string' ? destination : destination.uri;
      const prefix = this._uri.endsWith('/') ? this._uri : this._uri + '/';
      const target = destUri.endsWith('/') ? destUri + this.name : destUri + '/' + this.name;
      for (const uri of [...files.keys()]) {
        if (uri.startsWith(prefix)) {
          files.set(uri.replace(prefix, target + '/'), files.get(uri));
          files.delete(uri);
        }
      }
      for (const uri of [...dirs]) {
        if (uri.startsWith(prefix)) {
          dirs.delete(uri);
          dirs.add(uri.replace(prefix, target + '/'));
        }
      }
      dirs.delete(this._uri);
      this._uri = target;
    }
  }

  class File {
    constructor(...parts) {
      this._uri = join(...parts);
    }
    get uri() { return this._uri; }
    get name() { return nameOf(this._uri); }
    get extension() { return extensionOf(this._uri); }
    get exists() { return files.has(this._uri); }
    get size() {
      const data = files.get(this._uri);
      return data ? data.length : 0;
    }
    create() { files.set(this._uri, ''); }
    delete() { files.delete(this._uri); }
    write(content) {
      const data =
        content instanceof Uint8Array
          ? Buffer.from(content).toString('binary')
          : String(content);
      files.set(this._uri, data);
    }
    textSync() { return files.get(this._uri) ?? ''; }
    move(destination) {
      const destUri = typeof destination === 'string' ? destination : destination.uri;
      const target = destUri.endsWith('/') ? destUri + this.name : destUri + '/' + this.name;
      if (files.has(this._uri)) {
        files.set(target, files.get(this._uri));
        files.delete(this._uri);
      }
      this._uri = target;
    }
    copy(destination) {
      const destUri = typeof destination === 'string' ? destination : destination.uri;
      files.set(destUri, files.get(this._uri) ?? '');
    }
  }

  return {
    File,
    Directory,
    Paths: {
      document: new Directory(ROOT_URI),
      cache: new Directory(CACHE_URI),
    },
    __reset: () => {
      files.clear();
      dirs.clear();
      dirs.add(ROOT_URI);
      dirs.add(CACHE_URI);
    },
  };
});

jest.mock('expo-document-picker', () => ({
  getDocumentAsync: jest.fn(),
}));
