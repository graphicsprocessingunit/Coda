export const WHEEL_DIAMETER = 216;
export const WHEEL_CENTER_SIZE = 80;

export const WHEEL_PRESETS: { name: string; color: string }[] = [
  { name: 'Classic White', color: '#F2F2F2' },
  { name: 'Black', color: '#1A1A1A' },
  { name: 'Silver', color: '#C7CBD1' },
  { name: 'Blue', color: '#4A6696' },
  { name: 'Green', color: '#5E7F45' },
  { name: 'Pink', color: '#DF9BA6' },
];

export const SCREEN_BG_COLORS: { name: string; color: string }[] = [
  { name: 'Black', color: '#000000' },
  { name: 'Midnight', color: '#0A0E27' },
  { name: 'Graphite', color: '#1C1C1E' },
  { name: 'Ocean', color: '#0F172A' },
  { name: 'Light Gray', color: '#F2F2F7' },
  { name: 'White', color: '#FFFFFF' },
];

export const SCREEN_TEXT_COLORS: { name: string; color: string }[] = [
  { name: 'White', color: '#FFFFFF' },
  { name: 'Ice', color: '#F1F5F9' },
  { name: 'Light Gray', color: '#8E8E93' },
  { name: 'Black', color: '#000000' },
  { name: 'Navy', color: '#E8E8F0' },
];

export const HIGHLIGHT_COLORS: { name: string; color: string }[] = [
  { name: 'iOS Blue', color: '#007AFF' },
  { name: 'Electric Purple', color: '#6C5CE7' },
  { name: 'Cyan', color: '#06B6D4' },
  { name: 'iPod Blue', color: '#4A6696' },
  { name: 'iPod Green', color: '#5E7F45' },
  { name: 'Alert Red', color: '#FF3B30' },
  { name: 'Success Green', color: '#34C759' },
  { name: 'iPod Orange', color: '#FF9500' },
];

/** Returns dark glyph color on light wheels, light on dark wheels. */
export function contrastFor(hex: string): string {
  const m = /^#?([0-9a-fA-F]{6})$/.exec(hex);
  if (!m) return '#000000';
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  // Relative luminance per WCAG.
  const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return lum > 0.5 ? '#1A1A1A' : '#F0F0F0';
}