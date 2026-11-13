/**
 * LRC parsing and word-level timing.
 *
 * LRCLIB timestamps are line-level. To highlight individual words we use the
 * enhanced-LRC word tags (`<mm:ss.xx>`) when a file has them, and otherwise
 * spread each line's duration across its words weighted by syllable count, so
 * long words linger and short ones flash past.
 */

export interface LyricWord {
  text: string;
  /** Start of the word in milliseconds, relative to the track. */
  time: number;
}

export interface LyricLine {
  time: number;
  text: string;
  words: LyricWord[];
}

const LINE_TIMESTAMP = /\[(\d{1,3}):(\d{2})(?:[.:](\d{1,3}))?\]/g;
const WORD_TIMESTAMP = /<(\d{1,3}):(\d{2})(?:[.:,](\d{1,3}))?>/g;
const OFFSET_TAG = /\[offset:\s*([+-]?\d+)\s*\]/i;

const DEFAULT_LINE_DURATION_MS = 5000;
const MAX_LINE_DURATION_MS = 12000;

/**
 * Line-level LRC carries no word timings, so each word gets a share of an
 * estimated sung duration (roughly 280ms per syllable). The gap to the next
 * timestamp is only an upper bound: stretching words across an instrumental
 * break makes the highlight lag the vocals by many words.
 */
const SINGING_RATE_MS_PER_SYLLABLE = 280;
const MIN_SUNG_LINE_MS = 900;
const MAX_SUNG_LINE_MS = 8000;

function fractionToMs(fraction?: string): number {
  if (!fraction) return 0;
  if (fraction.length === 1) return parseInt(fraction, 10) * 100;
  if (fraction.length === 2) return parseInt(fraction, 10) * 10;
  return parseInt(fraction, 10);
}

function timestampToMs(minutes: string, seconds: string, fraction?: string): number {
  return parseInt(minutes, 10) * 60000 + parseInt(seconds, 10) * 1000 + fractionToMs(fraction);
}

/**
 * Rough syllable count used as a word's weight when interpolating timings.
 * Accented Latin vowels count; scripts without vowel letters (e.g. CJK) fall
 * back to one unit per character so long words still get more time.
 */
export function estimateSyllables(text: string): number {
  const letters = text.toLowerCase().replace(/[^a-zà-öø-ÿ]/g, '');
  if (!letters) return Math.max(1, Math.min(4, Math.ceil(text.length / 2)));
  const groups = letters.match(/[aeiouyàâäéèêëîïôöùûü]+/g);
  return Math.max(1, groups ? groups.length : 1);
}

function splitWords(raw: string, lineTime: number): LyricWord[] {
  const words: LyricWord[] = [];
  const tagRegex = new RegExp(WORD_TIMESTAMP.source, 'g');
  let cursor = 0;
  let pendingTime: number | null = null;
  let match: RegExpExecArray | null;

  const pushSegment = (segment: string) => {
    const tokens = segment.split(/\s+/).filter(Boolean);
    tokens.forEach((token, index) => {
      words.push({ text: token, time: index === 0 && pendingTime !== null ? pendingTime : -1 });
    });
    pendingTime = null;
  };

  while ((match = tagRegex.exec(raw)) !== null) {
    pushSegment(raw.slice(cursor, match.index));
    pendingTime = timestampToMs(match[1], match[2], match[3]);
    cursor = match.index + match[0].length;
  }
  pushSegment(raw.slice(cursor));

  if (words.length > 0 && words[0].time < 0) words[0].time = lineTime;
  return words;
}

/**
 * Fill in unknown word times between known anchors proportionally to syllable
 * weight. Anchors are explicit word tags plus the line start and line end.
 */
function interpolateWordTimes(words: LyricWord[], lineTime: number, lineEnd: number): void {
  if (words.length === 0) return;

  const anchors: { index: number; time: number }[] = [];
  if (words[0].time >= 0) anchors.push({ index: 0, time: words[0].time });
  for (let i = 1; i < words.length; i++) {
    if (words[i].time >= 0) anchors.push({ index: i, time: words[i].time });
  }
  if (anchors.length === 0 || anchors[0].index !== 0) {
    anchors.unshift({ index: 0, time: lineTime });
  }
  const lastAnchor = anchors[anchors.length - 1];
  anchors.push({
    index: words.length,
    time: Math.max(lineEnd, lastAnchor.time + 250),
  });

  for (let a = 0; a < anchors.length - 1; a++) {
    const from = anchors[a];
    const to = anchors[a + 1];
    let totalWeight = 0;
    for (let i = from.index; i < to.index; i++) totalWeight += estimateSyllables(words[i].text);
    const span = Math.max(0, to.time - from.time);
    let weightBefore = 0;
    for (let i = from.index; i < to.index; i++) {
      if (i > from.index && words[i].time < 0) {
        words[i].time = from.time + (span * weightBefore) / (totalWeight || 1);
      }
      weightBefore += estimateSyllables(words[i].text);
    }
  }

  let previous = lineTime;
  for (const word of words) {
    if (!Number.isFinite(word.time) || word.time < previous) word.time = previous;
    previous = word.time;
  }
}

/**
 * Parse an LRC document into timed lines and words. Accepts both plain LRC and
 * enhanced LRC with per-word tags; the `[offset:]` tag shifts everything.
 */
export function parseLyrics(raw: string): LyricLine[] {
  const offsetMatch = OFFSET_TAG.exec(raw);
  const offset = offsetMatch ? parseInt(offsetMatch[1], 10) : 0;
  const lines: LyricLine[] = [];

  for (const inputLine of raw.split('\n')) {
    const lineRegex = new RegExp(LINE_TIMESTAMP.source, 'g');
    const stamps = Array.from(inputLine.matchAll(lineRegex));
    if (stamps.length === 0) continue;

    const textOnly = inputLine.replace(new RegExp(LINE_TIMESTAMP.source, 'g'), '').trim();
    const stampsMs = stamps.map((stamp) => timestampToMs(stamp[1], stamp[2], stamp[3]));
    const base = stampsMs[0];
    const words = splitWords(textOnly, base);
    if (words.length === 0) continue;

    const text = words.map((word) => word.text).join(' ');
    for (const stamp of stampsMs) {
      const shift = stamp - base;
      lines.push({
        time: stamp - offset,
        text,
        words: words.map((word) => ({
          text: word.text,
          time: word.time >= 0 ? word.time + shift - offset : -1,
        })),
      });
    }
  }

  lines.sort((a, b) => a.time - b.time);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const next = lines[i + 1];
    const gap =
      next && next.time > line.time ? next.time - line.time : DEFAULT_LINE_DURATION_MS;
    const syllables = line.words.reduce(
      (sum, word) => sum + estimateSyllables(word.text),
      0
    );
    const sungSpan = Math.min(
      gap,
      MAX_LINE_DURATION_MS,
      Math.max(
        MIN_SUNG_LINE_MS,
        Math.min(MAX_SUNG_LINE_MS, syllables * SINGING_RATE_MS_PER_SYLLABLE)
      )
    );
    interpolateWordTimes(line.words, line.time, line.time + sungSpan);
  }

  return lines;
}

/** Legacy line-only view of the parsed lyrics (kept for existing callers/tests). */
export function parseSyncedLyrics(raw: string): { time: number; text: string }[] {
  return parseLyrics(raw).map(({ time, text }) => ({ time, text }));
}


export function findActiveLineIndex(lines: readonly { time: number }[], position: number): number {
  if (lines.length === 0) return -1;
  let lo = 0;
  let hi = lines.length - 1;
  let result = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (lines[mid].time <= position) {
      result = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return result;
}

/** Index of the word currently being sung, or -1 before the line starts. */
export function findActiveWordIndex(words: LyricWord[], position: number): number {
  if (words.length === 0) return -1;
  let lo = 0;
  let hi = words.length - 1;
  let result = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (words[mid].time <= position) {
      result = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return result;
}
