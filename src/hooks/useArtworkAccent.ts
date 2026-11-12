import { useEffect, useState } from 'react';
import { getCachedAccent, resolveAccent } from '../services/ArtworkAccent';

export function useArtworkAccent(
  artwork: string | undefined,
  fallbackAccent: string,
  background: string,
  isDark: boolean
): string {
  const [accent, setAccent] = useState<string>(() => {
    if (!artwork) return fallbackAccent;
    const cached = getCachedAccent(artwork);
    return typeof cached === 'string' ? cached : fallbackAccent;
  });

  useEffect(() => {
    let cancelled = false;

    if (!artwork) {
      setAccent(fallbackAccent);
      return;
    }

    const cached = getCachedAccent(artwork);
    if (cached !== undefined) {
      setAccent(cached ?? fallbackAccent);
      return;
    }

    setAccent(fallbackAccent);
    resolveAccent(artwork, fallbackAccent, background, isDark).then((resolved) => {
      if (!cancelled) setAccent(resolved);
    });

    return () => {
      cancelled = true;
    };
  }, [artwork, fallbackAccent, background, isDark]);

  return accent;
}
