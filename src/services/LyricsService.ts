import AsyncStorage from '@react-native-async-storage/async-storage';

const LYRICS_CACHE_PREFIX = '@coda_lyrics_';

interface LRCLIBSearchResult {
  syncedLyrics?: string;
  plainLyrics?: string;
  duration: number;
}

interface LRCLIBGetResponse {
  syncedLyrics?: string;
  plainLyrics?: string;
}

function cacheKey(artist: string, title: string): string {
  return `${LYRICS_CACHE_PREFIX}${artist}::${title}`;
}

function closestDuration(results: LRCLIBSearchResult[], targetSec: number): LRCLIBSearchResult | null {
  let best: LRCLIBSearchResult | null = null;
  let bestDiff = Infinity;
  for (const r of results) {
    const diff = Math.abs(r.duration - targetSec);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = r;
    }
  }
  return best;
}

export async function fetchLyrics(
  artist: string,
  title: string,
  _album: string,
  durationMs: number
): Promise<string | null> {
  const key = cacheKey(artist, title);

  const cached = await AsyncStorage.getItem(key);
  if (cached !== null) {
    return cached;
  }

  const durationSec = Math.round(durationMs / 1000);

  try {
    let lyrics: string | null = null;

    if (artist && artist !== 'Unknown Artist') {
      const params = new URLSearchParams({
        track_name: title,
        artist_name: artist,
      });
      const res = await fetch(`https://lrclib.net/api/search?${params}`, {
        headers: { 'User-Agent': 'Coda Music Player v1.0' },
      });
      if (res.ok) {
        const results: LRCLIBSearchResult[] = await res.json();
        if (results.length > 0) {
          const best = closestDuration(results, durationSec);
          if (best) {
            lyrics = best.syncedLyrics || best.plainLyrics || null;
          }
        }
      }
    }

    if (!lyrics) {
      const params = new URLSearchParams({ track_name: title });
      const res = await fetch(`https://lrclib.net/api/search?${params}`, {
        headers: { 'User-Agent': 'Coda Music Player v1.0' },
      });
      if (res.ok) {
        const results: LRCLIBSearchResult[] = await res.json();
        if (results.length > 0) {
          const best = closestDuration(results, durationSec);
          if (best) {
            lyrics = best.syncedLyrics || best.plainLyrics || null;
          }
        }
      }
    }

    if (lyrics) {
      await AsyncStorage.setItem(key, lyrics);
    }
    return lyrics;
  } catch {
    return null;
  }
}
