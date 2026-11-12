export interface Rgb {
  r: number;
  g: number;
  b: number;
}

export function normalizeHex(hex: string): string | null {
  if (typeof hex !== 'string') return null;
  const match = /^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.exec(hex.trim());
  if (!match) return null;
  let body = match[1];
  if (body.length === 3) {
    body = body
      .split('')
      .map((c) => c + c)
      .join('');
  }
  return `#${body.toUpperCase()}`;
}

export function hexToRgb(hex: string): Rgb | null {
  const normalized = normalizeHex(hex);
  if (!normalized) return null;
  const value = parseInt(normalized.slice(1), 16);
  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255,
  };
}

export function rgbToHex({ r, g, b }: Rgb): string {
  const to = (v: number) =>
    Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return `#${to(r)}${to(g)}${to(b)}`.toUpperCase();
}

export function withAlpha(hex: string, alpha: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
}

export function relativeLuminance({ r, g, b }: Rgb): number {
  const channels = [r, g, b].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

export function luminance(hex: string): number {
  const rgb = hexToRgb(hex);
  return rgb ? relativeLuminance(rgb) : 0;
}

export function contrastText(hex: string): '#FFFFFF' | '#000000' {
  return luminance(hex) > 0.5 ? '#000000' : '#FFFFFF';
}

export function contrastRatio(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  const light = Math.max(la, lb);
  const dark = Math.min(la, lb);
  return (light + 0.05) / (dark + 0.05);
}

export function saturation({ r, g, b }: Rgb): number {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max === 0) return 0;
  return (max - min) / max;
}

export function colorDistance(a: string, b: string): number {
  const ra = hexToRgb(a);
  const rb = hexToRgb(b);
  if (!ra || !rb) return Infinity;
  return Math.sqrt(
    Math.pow(ra.r - rb.r, 2) + Math.pow(ra.g - rb.g, 2) + Math.pow(ra.b - rb.b, 2)
  );
}

export function mix(a: string, b: string, t: number): string {
  const ca = hexToRgb(a);
  const cb = hexToRgb(b);
  if (!ca || !cb) return a;
  return rgbToHex({
    r: ca.r + (cb.r - ca.r) * t,
    g: ca.g + (cb.g - ca.g) * t,
    b: ca.b + (cb.b - ca.b) * t,
  });
}

export function isVivid(hex: string, minSaturation = 0.16): boolean {
  const rgb = hexToRgb(hex);
  if (!rgb) return false;
  const l = relativeLuminance(rgb);
  if (l < 0.03 || l > 0.96) return false;
  return saturation(rgb) >= minSaturation;
}
