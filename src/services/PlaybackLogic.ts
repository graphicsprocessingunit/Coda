export const CROSSFADE_TRIGGER_LEAD_MS = 500;
export const SCROBBLE_MAX_SECONDS = 240;

export interface PlayableTrack {
  uri: string;
  cachedUri?: string;
  source?: 'local' | 'navidrome';
}

export function isLocalFileUri(uri: string): boolean {
  return uri.startsWith('file://');
}

/**
 * The URI to hand to the audio player. A cached copy is only worth using while the file is
 * still on disk: after the cache is cleared, the old `cachedUri` makes AVPlayer try to open a
 * missing file instead of streaming the original.
 */
export function pickPlaybackUri(
  track: PlayableTrack,
  fileExists: (uri: string) => boolean
): string {
  const cached = track.cachedUri;
  if (cached && (!isLocalFileUri(cached) || fileExists(cached))) return cached;
  return track.uri;
}

/**
 * Whether the saved track can be restored on launch. Navidrome tracks are only restored from a
 * cached download (never streamed unprompted), and local files must still exist.
 */
export function canRestorePlayback(
  track: PlayableTrack,
  fileExists: (uri: string) => boolean
): boolean {
  if (track.source === 'navidrome') {
    return !!track.cachedUri && isLocalFileUri(track.cachedUri) && fileExists(track.cachedUri);
  }
  const uri = pickPlaybackUri(track, fileExists);
  return !isLocalFileUri(uri) || fileExists(uri);
}

export function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export interface CrossfadeGate {
  enabled: boolean;
  durationSeconds: number;
  repeatEnabled: boolean;
  active: boolean;
  started: boolean;
  remainingMs: number;
}

export function shouldStartCrossfade(gate: CrossfadeGate): boolean {
  if (!gate.enabled || gate.durationSeconds <= 0) return false;
  if (gate.repeatEnabled || gate.active || gate.started) return false;
  if (!Number.isFinite(gate.remainingMs)) return false;
  return (
    gate.remainingMs > 0 &&
    gate.remainingMs <= gate.durationSeconds * 1000 + CROSSFADE_TRIGGER_LEAD_MS
  );
}

export function scrobbleThresholdSeconds(trackDurationSeconds: number): number {
  if (!Number.isFinite(trackDurationSeconds) || trackDurationSeconds <= 0) return 0;
  return Math.min(SCROBBLE_MAX_SECONDS, trackDurationSeconds / 2);
}

export function shouldScrobble(
  elapsedSeconds: number,
  trackDurationSeconds: number,
  alreadySubmitted: boolean
): boolean {
  if (alreadySubmitted) return false;
  const threshold = scrobbleThresholdSeconds(trackDurationSeconds);
  if (threshold <= 0) return false;
  return elapsedSeconds >= threshold;
}
