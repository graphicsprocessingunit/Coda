/**
 * Onset detection and global lyric alignment.
 *
 * expo-audio can stream real-time PCM while a track plays. This module turns
 * those samples into an onset envelope and compares lyric line boundaries with
 * detected onsets. Only a consistent, well-supported global shift is returned;
 * otherwise nothing is applied, because a confident-but-wrong shift makes good
 * lyrics worse.
 */

export interface OnsetSample {
  /** Position in the track, in seconds. */
  time: number;
  /** RMS energy of the sample chunk, 0..1-ish. */
  energy: number;
}

export interface Onset {
  /** Position in the track, in milliseconds. */
  time: number;
  /** Normalized novelty strength, 0..1. */
  strength: number;
}

export interface LyricOffsetEstimate {
  offsetMs: number;
  /** 0..1; higher means more lines agreed on the same shift. */
  confidence: number;
  matchedLines: number;
}

export interface EstimateOptions {
  /** How far from a line an onset may sit to be considered a candidate. */
  matchWindowMs?: number;
  minLines?: number;
  minMatched?: number;
  minConfidence?: number;
  maxShiftMs?: number;
}

const MIN_ONSET_STRENGTH = 0.25;
const MIN_ONSET_SPACING_MS = 120;
const INLIER_WINDOW_MS = 200;
const MAX_MAD_MS = 180;
const MIN_SHIFT_MS = 120;

/** Root-mean-square energy of a PCM frame chunk. */
export function computeSampleEnergy(frames: readonly number[]): number {
  if (frames.length === 0) return 0;
  let sum = 0;
  for (const frame of frames) {
    const value = Number.isFinite(frame) ? frame : 0;
    sum += value * value;
  }
  return Math.sqrt(sum / frames.length);
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

/**
 * Positive energy flux between consecutive sample chunks, peak-picked and
 * normalized. Chunk timestamps come from the player, so no sample rate is
 * assumed.
 */
export function buildOnsetEnvelope(
  samples: readonly OnsetSample[],
  options: { minStrength?: number } = {}
): Onset[] {
  const minStrength = options.minStrength ?? MIN_ONSET_STRENGTH;
  const sorted = samples
    .filter((sample) => Number.isFinite(sample.time) && Number.isFinite(sample.energy))
    .sort((a, b) => a.time - b.time);
  if (sorted.length < 3) return [];

  const flux: number[] = new Array(sorted.length).fill(0);
  for (let i = 1; i < sorted.length; i++) {
    flux[i] = Math.max(0, sorted[i].energy - sorted[i - 1].energy);
  }

  const positive = flux.filter((value) => value > 0).sort((a, b) => a - b);
  if (positive.length === 0) return [];
  // Use a high percentile rather than the maximum so one loud hit does not
  // flatten every other onset to zero.
  const reference = positive[Math.floor(positive.length * 0.9)];
  if (reference <= 0) return [];

  const onsets: Onset[] = [];
  for (let i = 1; i < flux.length - 1; i++) {
    // A local maximum keeps the onset at the attack rather than on the decay.
    if (flux[i] < flux[i - 1] || flux[i] < flux[i + 1]) continue;
    const strength = Math.min(1, flux[i] / reference);
    if (strength < minStrength) continue;

    const time = sorted[i].time * 1000;
    const previous = onsets[onsets.length - 1];
    if (previous && time - previous.time < MIN_ONSET_SPACING_MS) {
      if (strength > previous.strength) {
        onsets[onsets.length - 1] = { time, strength };
      }
      continue;
    }
    onsets.push({ time, strength });
  }

  return onsets;
}

/**
 * Estimate one global shift for the whole track: pair every lyric line with
 * its nearest strong onset, take the median delta, then require that most
 * lines agree within a tight window. The result is deliberately conservative.
 */
export function estimateLyricOffset(
  lineTimesMs: readonly number[],
  onsets: readonly Onset[],
  options: EstimateOptions = {}
): LyricOffsetEstimate | null {
  const matchWindowMs = options.matchWindowMs ?? 1200;
  const minLines = options.minLines ?? 8;
  const minMatched = options.minMatched ?? 5;
  const minConfidence = options.minConfidence ?? 0.6;
  const maxShiftMs = options.maxShiftMs ?? 1500;

  const lineTimes = Array.from(
    new Set(lineTimesMs.filter((time) => Number.isFinite(time) && time >= 0))
  ).sort((a, b) => a - b);
  if (lineTimes.length < minLines) return null;

  const strongOnsets = onsets.filter(
    (onset) => Number.isFinite(onset.time) && onset.strength >= MIN_ONSET_STRENGTH
  );
  if (strongOnsets.length < minMatched) return null;

  const deltas: number[] = [];
  for (const lineTime of lineTimes) {
    let nearest: Onset | null = null;
    let nearestDistance = Infinity;
    for (const onset of strongOnsets) {
      const distance = Math.abs(onset.time - lineTime);
      if (distance <= matchWindowMs && distance < nearestDistance) {
        nearest = onset;
        nearestDistance = distance;
      }
    }
    if (nearest) deltas.push(nearest.time - lineTime);
  }

  if (deltas.length < minMatched) return null;

  const medianDelta = median(deltas);
  const mad = median(deltas.map((delta) => Math.abs(delta - medianDelta)));
  const inliers = deltas.filter((delta) => Math.abs(delta - medianDelta) <= INLIER_WINDOW_MS);
  const ratio = inliers.length / lineTimes.length;

  if (inliers.length < minMatched) return null;
  if (ratio < 0.35) return null;
  if (mad > MAX_MAD_MS) return null;
  if (Math.abs(medianDelta) < MIN_SHIFT_MS) return null;
  if (Math.abs(medianDelta) > maxShiftMs) return null;

  const confidence = Math.min(
    1,
    0.6 * ratio + 0.4 * (1 - Math.min(1, mad / (MAX_MAD_MS * 2)))
  );
  if (confidence < minConfidence) return null;

  return {
    offsetMs: Math.round(medianDelta),
    confidence,
    matchedLines: inliers.length,
  };
}
