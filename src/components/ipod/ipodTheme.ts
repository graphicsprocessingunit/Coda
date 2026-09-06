export const WHEEL_DIAMETER = 240;
export const WHEEL_CENTER_SIZE = 84;
export const IPOD_ROW_HEIGHT = 44;

export interface IpodFinish {
  id: string;
  label: string;
  /** Device body / faceplate color. */
  faceplate: string;
  /** Darker edge tone for the faceplate seam. */
  faceplateEdge: string;
  /** Click wheel disc color. */
  wheelFace: string;
  /** Printed label color engraved on the wheel surface. */
  wheelLabel: string;
  /** Center SELECT button color (raised, glossy on real devices). */
  centerFace: string;
}

/**
 * Curated, period-accurate finishes. All screen styling stays on the fixed
 * classic black-on-white LCD regardless of finish — exactly like the real
 * devices where only the case/wheel changed color.
 */
export const IPOD_FINISHES: IpodFinish[] = [
  { id: 'classic-white', label: 'Classic White', faceplate: '#F5F5F3', faceplateEdge: '#DADAD6', wheelFace: '#ECECEA', wheelLabel: '#9A9A9E', centerFace: '#F1F1EF' },
  { id: 'classic-black', label: 'Classic Black', faceplate: '#1E1E20', faceplateEdge: '#000000', wheelFace: '#2C2C2E', wheelLabel: '#919196', centerFace: '#3A3A3C' },
  { id: 'aluminum', label: 'Aluminum (7G)', faceplate: '#CBD0D6', faceplateEdge: '#A2A7AC', wheelFace: '#BCC1C7', wheelLabel: '#70757B', centerFace: '#C4C9CE' },
  { id: 'mini-silver', label: 'Mini Silver', faceplate: '#E7E7E5', faceplateEdge: '#C5C5C1', wheelFace: '#F0F0EE', wheelLabel: '#9A9A9E', centerFace: '#E9E9E7' },
  { id: 'mini-blue', label: 'Mini Blue', faceplate: '#7B9DC4', faceplateEdge: '#5D7EA4', wheelFace: '#EFEFED', wheelLabel: '#9A9A9E', centerFace: '#E9E9E7' },
  { id: 'mini-green', label: 'Mini Green', faceplate: '#82A67F', faceplateEdge: '#63885F', wheelFace: '#EFEFED', wheelLabel: '#9A9A9E', centerFace: '#E9E9E7' },
  { id: 'mini-pink', label: 'Mini Pink', faceplate: '#E5B6BA', faceplateEdge: '#C8999E', wheelFace: '#EFEFED', wheelLabel: '#9A9A9E', centerFace: '#E9E9E7' },
  { id: 'mini-gold', label: 'Mini Gold', faceplate: '#D5B593', faceplateEdge: '#B59370', wheelFace: '#EFEFED', wheelLabel: '#9A9A9E', centerFace: '#E9E9E7' },
];

export const DEFAULT_FINISH_ID = 'classic-white';

export function finishFor(id?: string): IpodFinish {
  return IPOD_FINISHES.find((f) => f.id === id) ?? IPOD_FINISHES[0];
}

/** Picks the finish whose wheel/faceplate color is visually closest to `hex`. */
export function nearestFinish(hex?: string): string {
  if (typeof hex !== 'string') return DEFAULT_FINISH_ID;
  const m = /^#?([0-9a-fA-F]{6})$/.exec(hex);
  if (!m) return DEFAULT_FINISH_ID;
  const n = parseInt(m[1], 16);
  const tr = (n >> 16) & 255;
  const tg = (n >> 8) & 255;
  const tb = n & 255;
  let best = DEFAULT_FINISH_ID;
  let bestDist = Infinity;
  for (const f of IPOD_FINISHES) {
    const fm = /^#?([0-9a-fA-F]{6})$/.exec(f.wheelFace)!;
    const fn = parseInt(fm[1], 16);
    const fr = (fn >> 16) & 255;
    const fg = (fn >> 8) & 255;
    const fb = fn & 255;
    const d = (fr - tr) * (fr - tr) + (fg - tg) * (fg - tg) + (fb - tb) * (fb - tb);
    if (d < bestDist) {
      bestDist = d;
      best = f.id;
    }
  }
  return best;
}

/**
 * The classic LCD screen palette. Fixed regardless of finish — the real iPod
 * screen never changed color to match the case.
 */
export const IPOD_SCREEN = {
  bg: '#FFFFFF',
  text: '#101010',
  secondary: '#717175',
  chevron: '#9A9A9E',
  divider: '#D7D7D7',
  highlightTop: '#3B6BB0',
  highlightBottom: '#6FA8D8',
  highlightText: '#FFFFFF',
};

/** Classic 6G Now Playing screen (black, glowing art, thin progress bar). */
export const IPOD_NOWPLAYING = {
  bg: '#000000',
  text: '#FFFFFF',
  secondary: '#A2A2A6',
  dim: '#6E6E72',
  track: 'rgba(255,255,255,0.28)',
  fill: '#6FA8D8',
  border: 'rgba(255,255,255,0.22)',
};

export const SCREEN_TOP_BAR_HEIGHT = 26;