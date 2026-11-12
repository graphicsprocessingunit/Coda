import AsyncStorage from '@react-native-async-storage/async-storage';
import ImageColors, { ImageColorsResult } from 'react-native-image-colors';
import { contrastRatio, isVivid, mix, normalizeHex } from '../utils/color';

const CACHE_KEY = '@coda_artwork_accents_v1';
const MAX_PERSISTED = 300;
const MIN_VISIBLE_CONTRAST = 1.7;

const memory = new Map<string, string | null>();
let loaded = false;
let loadPromise: Promise<void> | null = null;
let persistTimer: ReturnType<typeof setTimeout> | null = null;

export function pickAccent(result: ImageColorsResult): string | null {
  const candidates: string[] = [];
  if (result.platform === 'ios') {
    candidates.push(result.primary, result.detail, result.secondary, result.background);
  } else if (result.platform === 'android') {
    candidates.push(result.vibrant, result.dominant, result.muted, result.average);
  } else {
    candidates.push(result.vibrant, result.dominant, result.muted);
  }

  for (const candidate of candidates) {
    const hex = normalizeHex(candidate);
    if (hex && isVivid(hex)) return hex;
  }
  return null;
}

export function ensureVisible(accent: string, background: string, isDark: boolean): string | null {
  let result = accent;
  let t = 0;
  while (contrastRatio(result, background) < MIN_VISIBLE_CONTRAST && t < 1) {
    t += 0.1;
    result = mix(accent, isDark ? '#FFFFFF' : '#000000', Math.min(t, 1));
  }
  return contrastRatio(result, background) >= MIN_VISIBLE_CONTRAST ? result : null;
}

async function ensureLoaded(): Promise<void> {
  if (loaded) return;
  if (loadPromise) return loadPromise;
  loadPromise = (async () => {
    try {
      const raw = await AsyncStorage.getItem(CACHE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Record<string, unknown>;
        for (const [key, value] of Object.entries(parsed)) {
          if (typeof value === 'string') memory.set(key, value);
        }
      }
    } catch {}
    loaded = true;
  })();
  return loadPromise;
}

async function persist(): Promise<void> {
  try {
    const entries = Array.from(memory.entries())
      .filter((entry): entry is [string, string] => typeof entry[1] === 'string')
      .slice(-MAX_PERSISTED);
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(Object.fromEntries(entries)));
  } catch {}
}

function schedulePersist(): void {
  if (persistTimer) return;
  persistTimer = setTimeout(() => {
    persistTimer = null;
    void persist();
  }, 1500);
}

export function getCachedAccent(uri: string): string | null | undefined {
  return memory.get(uri);
}

export async function extractAccent(uri: string): Promise<string | null> {
  if (!uri) return null;
  await ensureLoaded();
  if (memory.has(uri)) return memory.get(uri) ?? null;

  let accent: string | null = null;
  try {
    const result = await ImageColors.getColors(uri, {
      fallback: '#000000',
      cache: true,
      key: uri,
      quality: 'low',
      pixelSpacing: 10,
    });
    accent = pickAccent(result);
  } catch {
    accent = null;
  }

  memory.set(uri, accent);
  schedulePersist();
  return accent;
}

export async function resolveAccent(
  uri: string,
  fallbackAccent: string,
  background: string,
  isDark: boolean
): Promise<string> {
  const extracted = await extractAccent(uri);
  if (!extracted) return fallbackAccent;
  return ensureVisible(extracted, background, isDark) ?? fallbackAccent;
}

export function clearArtworkAccentCache(): void {
  memory.clear();
  loaded = true;
  void AsyncStorage.removeItem(CACHE_KEY);
}
