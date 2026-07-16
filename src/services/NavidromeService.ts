import AsyncStorage from '@react-native-async-storage/async-storage';
import { TrackMetadata } from '../context/AudioContext';

const STORAGE_KEYS = {
  CREDENTIALS: '@coda_navidrome_credentials',
};

export interface NavidromeCredentials {
  url: string;
  username: string;
  token: string;
  salt: string;
}

export interface NavidromeArtist {
  id: string;
  name: string;
  albumCount?: number;
  coverArt?: string;
}

export interface NavidromeAlbum {
  id: string;
  name: string;
  artist?: string;
  artistId?: string;
  songCount?: number;
  coverArt?: string;
  year?: number;
}

export interface NavidromeSong {
  id: string;
  title: string;
  artist?: string;
  artistId?: string;
  album?: string;
  albumId?: string;
  duration?: number;
  track?: number;
  coverArt?: string;
}

function generateSalt(): string {
  const chars = 'abcdef0123456789';
  let salt = '';
  for (let i = 0; i < 16; i++) {
    salt += chars[Math.floor(Math.random() * chars.length)];
  }
  return salt;
}

function md5(str: string): string {
  // Simple MD5 implementation for Subsonic auth
  function safeAdd(x: number, y: number): number {
    const lsw = (x & 0xffff) + (y & 0xffff);
    const msw = (x >> 16) + (y >> 16) + (lsw >> 16);
    return (msw << 16) | (lsw & 0xffff);
  }
  function bitRotateLeft(num: number, cnt: number): number {
    return (num << cnt) | (num >>> (32 - cnt));
  }
  function addUnsigned(x: number, y: number): number {
    const x8 = x & 0x80000000;
    const y8 = y & 0x80000000;
    const x4 = x & 0x40000000;
    const y4 = y & 0x40000000;
    const result = (x & 0x3fffffff) + (y & 0x3fffffff);
    if (x4 & y4) return (result ^ 0x80000000 ^ x8 ^ y8);
    if (x4 | y4) return (result & 0x40000000) ? (result ^ 0xc0000000 ^ x8 ^ y8) : (result ^ 0x40000000 ^ x8 ^ y8);
    return (result ^ x8 ^ y8);
  }
  function f(x: number, y: number, z: number): number { return (x & y) | ((~x) & z); }
  function g(x: number, y: number, z: number): number { return (x & z) | (y & (~z)); }
  function h(x: number, y: number, z: number): number { return x ^ y ^ z; }
  function ii(x: number, y: number, z: number): number { return y ^ (x | (~z)); }
  function transform(fn: (x: number, y: number, z: number) => number, a: number, b: number, c: number, d: number, x: number, s: number, ac: number): number {
    a = addUnsigned(a, addUnsigned(addUnsigned(fn(b, c, d), x), ac));
    return addUnsigned(bitRotateLeft(a, s), b);
  }
  function utf8Encode(str: string): number[] {
    const result: number[] = [];
    for (let i = 0; i < str.length; i++) {
      let c = str.charCodeAt(i);
      if (c < 128) { result.push(c); }
      else if (c < 2048) { result.push((c >> 6) | 192); result.push((c & 63) | 128); }
      else { result.push((c >> 12) | 224); result.push(((c >> 6) & 63) | 128); result.push((c & 63) | 128); }
    }
    return result;
  }
  function wordToHex(val: number): string {
    let result = '';
    for (let i = 0; i <= 3; i++) {
      const b = (val >>> (i * 8)) & 255;
      result += ('0' + b.toString(16)).slice(-2);
    }
    return result;
  }

  const x = utf8Encode(str);
  const len = x.length;
  let a = 0x67452301;
  let b = 0xefcdab89;
  let c = 0x98badcfe;
  let d = 0x10325476;

  let i = 0;
  while (i < len) {
    const oldA = a, oldB = b, oldC = c, oldD = d;
    // Round 1
    a = transform(f, a, b, c, d, x[i], 7, 0xd76aa478); d = transform(f, d, a, b, c, x[i+1], 12, 0xe8c7b756);
    c = transform(f, c, d, a, b, x[i+2], 17, 0x242070db); b = transform(f, b, c, d, a, x[i+3], 22, 0xc1bdceee);
    a = transform(f, a, b, c, d, x[i+4], 7, 0xf57c0faf); d = transform(f, d, a, b, c, x[i+5], 12, 0x4787c62a);
    c = transform(f, c, d, a, b, x[i+6], 17, 0xa8304613); b = transform(f, b, c, d, a, x[i+7], 22, 0xfd469501);
    a = transform(f, a, b, c, d, x[i+8], 7, 0x698098d8); d = transform(f, d, a, b, c, x[i+9], 12, 0x8b44f7af);
    c = transform(f, c, d, a, b, x[i+10], 17, 0xffff5bb1); b = transform(f, b, c, d, a, x[i+11], 22, 0x895cd7be);
    a = transform(f, a, b, c, d, x[i+12], 7, 0x6b901122); d = transform(f, d, a, b, c, x[i+13], 12, 0xfd987193);
    c = transform(f, c, d, a, b, x[i+14], 17, 0xa679438e); b = transform(f, b, c, d, a, x[i+15], 22, 0x49b40821);
    // Round 2
    a = transform(g, a, b, c, d, x[i+1], 5, 0xf61e2562); d = transform(g, d, a, b, c, x[i+6], 9, 0xc040b340);
    c = transform(g, c, d, a, b, x[i+11], 14, 0x265e5a51); b = transform(g, b, c, d, a, x[i], 20, 0xe9b6c7aa);
    a = transform(g, a, b, c, d, x[i+5], 5, 0xd62f105d); d = transform(g, d, a, b, c, x[i+10], 9, 0x02441453);
    c = transform(g, c, d, a, b, x[i+15], 14, 0xd8a1e681); b = transform(g, b, c, d, a, x[i+4], 20, 0xe7d3fbc8);
    a = transform(g, a, b, c, d, x[i+9], 5, 0x21e1cde6); d = transform(g, d, a, b, c, x[i+14], 9, 0xc33707d6);
    c = transform(g, c, d, a, b, x[i+3], 14, 0xf4d50d87); b = transform(g, b, c, d, a, x[i+8], 20, 0x455a14ed);
    a = transform(g, a, b, c, d, x[i+13], 5, 0xa9e3e905); d = transform(g, d, a, b, c, x[i+2], 9, 0xfcefa3f8);
    c = transform(g, c, d, a, b, x[i+7], 14, 0x676f02d9); b = transform(g, b, c, d, a, x[i+12], 20, 0x8d2a4c8a);
    // Round 3
    a = transform(h, a, b, c, d, x[i+5], 4, 0xfffa3942); d = transform(h, d, a, b, c, x[i+8], 11, 0x8771f681);
    c = transform(h, c, d, a, b, x[i+11], 16, 0x6d9d6122); b = transform(h, b, c, d, a, x[i+14], 23, 0xfde5380c);
    a = transform(h, a, b, c, d, x[i+1], 4, 0xa4beea44); d = transform(h, d, a, b, c, x[i+4], 11, 0x4bdecfa9);
    c = transform(h, c, d, a, b, x[i+7], 16, 0xf6bb4b60); b = transform(h, b, c, d, a, x[i+10], 23, 0xbebfbc70);
    a = transform(h, a, b, c, d, x[i+13], 4, 0x289b7ec6); d = transform(h, d, a, b, c, x[i+0], 11, 0xeaa127fa);
    c = transform(h, c, d, a, b, x[i+3], 16, 0xd4ef3085); b = transform(h, b, c, d, a, x[i+6], 23, 0x04881d05);
    a = transform(h, a, b, c, d, x[i+9], 4, 0xd9d4d039); d = transform(h, d, a, b, c, x[i+12], 11, 0xe6db99e5);
    c = transform(h, c, d, a, b, x[i+15], 16, 0x1fa27cf8); b = transform(h, b, c, d, a, x[i+2], 23, 0xc4ac5665);
    // Round 4
    a = transform(ii, a, b, c, d, x[i], 6, 0xf4292244); d = transform(ii, d, a, b, c, x[i+7], 10, 0x432aff97);
    c = transform(ii, c, d, a, b, x[i+14], 15, 0xab9423a7); b = transform(ii, b, c, d, a, x[i+5], 21, 0xfc93a039);
    a = transform(ii, a, b, c, d, x[i+12], 6, 0x655b59c3); d = transform(ii, d, a, b, c, x[i+3], 10, 0x8f0ccc92);
    c = transform(ii, c, d, a, b, x[i+10], 15, 0xffeff47d); b = transform(ii, b, c, d, a, x[i+1], 21, 0x85845dd1);
    a = transform(ii, a, b, c, d, x[i+8], 6, 0x6fa87e4f); d = transform(ii, d, a, b, c, x[i+15], 10, 0xfe2ce6e0);
    c = transform(ii, c, d, a, b, x[i+6], 15, 0xa3014314); b = transform(ii, b, c, d, a, x[i+13], 21, 0x4e0811a1);
    a = transform(ii, a, b, c, d, x[i+4], 6, 0xf7537e82); d = transform(ii, d, a, b, c, x[i+11], 10, 0xbd3af235);
    c = transform(ii, c, d, a, b, x[i+2], 15, 0x2ad7d2bb); b = transform(ii, b, c, d, a, x[i+9], 21, 0xeb86d391);
    a = addUnsigned(a, oldA); b = addUnsigned(b, oldB); c = addUnsigned(c, oldC); d = addUnsigned(d, oldD);
    i += 16;
  }
  return wordToHex(a) + wordToHex(b) + wordToHex(c) + wordToHex(d);
}

export class NavidromeService {
  static async saveCredentials(creds: NavidromeCredentials): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.CREDENTIALS, JSON.stringify(creds));
    } catch (error) {
      console.error('Error saving Navidrome credentials:', error);
    }
  }

  static async loadCredentials(): Promise<NavidromeCredentials | null> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.CREDENTIALS);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('Error loading Navidrome credentials:', error);
      return null;
    }
  }

  static async clearCredentials(): Promise<void> {
    try {
      await AsyncStorage.removeItem(STORAGE_KEYS.CREDENTIALS);
    } catch (error) {
      console.error('Error clearing Navidrome credentials:', error);
    }
  }

  static createToken(password: string, salt: string): string {
    return md5(password + salt);
  }

  static buildUrl(creds: NavidromeCredentials, endpoint: string, params?: Record<string, string>): string {
    const baseUrl = creds.url.replace(/\/+$/, '');
    const queryParams: Record<string, string> = {
      u: creds.username,
      t: creds.token,
      s: creds.salt,
      v: '1.16.1',
      c: 'Coda',
      f: 'json',
      ...params,
    };
    const queryString = Object.entries(queryParams)
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .join('&');
    return `${baseUrl}/rest/${endpoint}.view?${queryString}`;
  }

  static getStreamUrl(creds: NavidromeCredentials, songId: string): string {
    return NavidromeService.buildUrl(creds, 'stream', { id: songId });
  }

  static getCoverArtUrl(creds: NavidromeCredentials, coverArtId: string, size?: number): string {
    const params: Record<string, string> = { id: coverArtId };
    if (size) params.size = size.toString();
    return NavidromeService.buildUrl(creds, 'getCoverArt', params);
  }

  static async apiCall<T>(creds: NavidromeCredentials, endpoint: string, params?: Record<string, string>): Promise<T> {
    const url = NavidromeService.buildUrl(creds, endpoint, params);
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const json = await response.json();
    const subsonicResponse = json['subsonic-response'];
    if (subsonicResponse?.status === 'failed') {
      throw new Error(subsonicResponse.error?.message || 'Subsonic API error');
    }
    return subsonicResponse as T;
  }

  static async ping(url: string, username: string, password: string): Promise<{ ok: boolean; error?: string }> {
    try {
      const salt = generateSalt();
      const token = NavidromeService.createToken(password, salt);
      const creds: NavidromeCredentials = { url, username, token, salt };
      await NavidromeService.apiCall(creds, 'ping');
      return { ok: true };
    } catch (error: any) {
      return { ok: false, error: error.message || 'Connection failed' };
    }
  }

  static async getArtists(creds: NavidromeCredentials): Promise<NavidromeArtist[]> {
    try {
      const response = await NavidromeService.apiCall<any>(creds, 'getArtists');
      const artists = response?.['artists']?.['index'] || [];
      const result: NavidromeArtist[] = [];
      for (const index of artists) {
        for (const artist of index.artist || []) {
          result.push({
            id: artist.id,
            name: artist.name,
            albumCount: artist.albumCount,
            coverArt: artist.coverArt,
          });
        }
      }
      return result.sort((a, b) => a.name.localeCompare(b.name));
    } catch (error) {
      console.error('Error fetching artists:', error);
      return [];
    }
  }

  static async getArtist(creds: NavidromeCredentials, artistId: string): Promise<{ artist: NavidromeArtist; albums: NavidromeAlbum[] }> {
    try {
      const response = await NavidromeService.apiCall<any>(creds, 'getArtist', { id: artistId });
      const artistData = response?.['artist'];
      const artist: NavidromeArtist = {
        id: artistData.id,
        name: artistData.name,
        albumCount: artistData.albumCount,
        coverArt: artistData.coverArt,
      };
      const albums: NavidromeAlbum[] = (artistData.album || []).map((a: any) => ({
        id: a.id,
        name: a.name,
        artist: a.artist,
        artistId: a.artistId,
        songCount: a.songCount,
        coverArt: a.coverArt,
        year: a.year,
      }));
      return { artist, albums };
    } catch (error) {
      console.error('Error fetching artist:', error);
      return { artist: { id: artistId, name: 'Unknown' }, albums: [] };
    }
  }

  static async getAlbum(creds: NavidromeCredentials, albumId: string): Promise<{ album: NavidromeAlbum; songs: NavidromeSong[] }> {
    try {
      const response = await NavidromeService.apiCall<any>(creds, 'getAlbum', { id: albumId });
      const albumData = response?.['album'];
      const album: NavidromeAlbum = {
        id: albumData.id,
        name: albumData.name,
        artist: albumData.artist,
        artistId: albumData.artistId,
        songCount: albumData.songCount,
        coverArt: albumData.coverArt,
        year: albumData.year,
      };
      const songs: NavidromeSong[] = (albumData.song || []).map((s: any) => ({
        id: s.id,
        title: s.title,
        artist: s.artist,
        artistId: s.artistId,
        album: s.album,
        albumId: s.albumId,
        duration: s.duration,
        track: s.track,
        coverArt: s.coverArt,
      }));
      return { album, songs };
    } catch (error) {
      console.error('Error fetching album:', error);
      return { album: { id: albumId, name: 'Unknown' }, songs: [] };
    }
  }

  static async search(creds: NavidromeCredentials, query: string): Promise<{ artists: NavidromeArtist[]; albums: NavidromeAlbum[]; songs: NavidromeSong[] }> {
    try {
      const response = await NavidromeService.apiCall<any>(creds, 'search3', {
        query,
        artistCount: '10',
        albumCount: '10',
        songCount: '20',
      });
      const results = response?.['searchResult3'] || {};
      return {
        artists: (results.artist || []).map((a: any) => ({
          id: a.id,
          name: a.name,
          albumCount: a.albumCount,
          coverArt: a.coverArt,
        })),
        albums: (results.album || []).map((a: any) => ({
          id: a.id,
          name: a.name,
          artist: a.artist,
          artistId: a.artistId,
          songCount: a.songCount,
          coverArt: a.coverArt,
          year: a.year,
        })),
        songs: (results.song || []).map((s: any) => ({
          id: s.id,
          title: s.title,
          artist: s.artist,
          artistId: s.artistId,
          album: s.album,
          albumId: s.albumId,
          duration: s.duration,
          track: s.track,
          coverArt: s.coverArt,
        })),
      };
    } catch (error) {
      console.error('Error searching:', error);
      return { artists: [], albums: [], songs: [] };
    }
  }

  static songToTrackMetadata(creds: NavidromeCredentials, song: NavidromeSong): TrackMetadata {
    return {
      title: song.title,
      artist: song.artist || 'Unknown Artist',
      uri: NavidromeService.getStreamUrl(creds, song.id),
      duration: song.duration,
      artwork: song.coverArt ? NavidromeService.getCoverArtUrl(creds, song.coverArt, 300) : undefined,
      source: 'navidrome',
      navidromeId: song.id,
    };
  }
}
