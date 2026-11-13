export function formatDuration(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function formatLongDuration(ms: number): string {
  const totalMin = Math.round(ms / 60000);
  if (totalMin < 60) return `${totalMin} min`;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return m > 0 ? `${h} hr ${m} min` : `${h} hr`;
}

/**
 * Track metadata (Subsonic/Navidrome) stores lengths in whole seconds, while
 * the player reports milliseconds. These helpers keep the conversion at the
 * display boundary explicit rather than relying on the caller's memory.
 */
export function formatDurationFromSeconds(seconds: number): string {
  return formatDuration(seconds * 1000);
}

export function formatLongDurationFromSeconds(seconds: number): string {
  return formatLongDuration(seconds * 1000);
}
