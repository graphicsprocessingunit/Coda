import AsyncStorage from '@react-native-async-storage/async-storage';

const LYRICS_CACHE_PREFIX = '@coda_lyrics_';

interface LRCLIBResponse {
  syncLyrics?: string;
  plainLyrics?: string;
}

function cacheKey(artist: string, title: string, duration: number): string {
  return `${LYRICS_CACHE_PREFIX}${artist}::${title}::${duration}`;
}

export async function fetchLyrics(
  artist: string,
  title: string,
  album: string,
  duration: number
): Promise<string | null> {
  const key = cacheKey(artist, title, duration);

  const cached = await AsyncStorage.getItem(key);
  if (cached !== null) {
    return cached === '__NONE__' ? null : cached;
  }

  try {
    const params = new URLSearchParams({
      artist_name: artist,
      track_name: title,
      album_name: album,
      duration: String(Math.round(duration)),
    });

    const res = await fetch(`https://lrclib.net/api/get?${params}`, {
      headers: { 'User-Agent': 'Coda Music Player v1.0' },
    });

    if (!res.ok) {
      await AsyncStorage.setItem(key, '__NONE__');
      return null;
    }

    const data: LRCLIBResponse = await res.json();
    const lyrics = data.syncLyrics || data.plainLyrics || null;

    await AsyncStorage.setItem(key, lyrics ? lyrics : '__NONE__');
    return lyrics;
  } catch {
    return null;
  }
}
