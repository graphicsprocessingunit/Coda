import {
  buildOnsetEnvelope,
  computeSampleEnergy,
  estimateLyricOffset,
  type Onset,
  type OnsetSample,
} from '../src/services/LyricsOnset';
import { parseLyrics, shiftLyricLines } from '../src/utils/lyrics';

const sample = (time: number, energy: number): OnsetSample => ({ time, energy });
const onset = (time: number, strength = 1): Onset => ({ time, strength });

const LINES = [10000, 15000, 20000, 25000, 30000, 35000, 40000, 45000];
const atShift = (shiftMs: number, lines = LINES): Onset[] =>
  lines.map((line) => onset(line + shiftMs));

describe('computeSampleEnergy', () => {
  it('returns the RMS of the PCM frames', () => {
    expect(computeSampleEnergy([1, -1, 1, -1])).toBe(1);
    expect(computeSampleEnergy([0, 0, 0])).toBe(0);
    expect(computeSampleEnergy([0.5, -0.5])).toBeCloseTo(0.5, 6);
  });

  it('handles empty and non-finite frames', () => {
    expect(computeSampleEnergy([])).toBe(0);
    expect(computeSampleEnergy([Number.NaN, 1])).toBeCloseTo(Math.SQRT1_2, 6);
  });
});

describe('buildOnsetEnvelope', () => {
  it('peak-picks positive energy flux and normalizes strength', () => {
    const onsets = buildOnsetEnvelope([
      sample(0, 0.1),
      sample(0.05, 0.1),
      sample(0.1, 0.9),
      sample(0.15, 0.1),
      sample(0.2, 0.1),
      sample(0.25, 1),
      sample(0.3, 0.1),
      sample(0.35, 0.1),
    ]);

    expect(onsets.map((entry) => entry.time)).toEqual([100, 250]);
    expect(onsets[0].strength).toBeCloseTo(0.8 / 0.9, 5);
    expect(onsets[1].strength).toBe(1);
  });

  it('returns no onsets for flat or decaying audio', () => {
    expect(buildOnsetEnvelope([sample(0, 0.5), sample(0.05, 0.5), sample(0.1, 0.5)])).toEqual([]);
    expect(buildOnsetEnvelope([sample(0, 0.9), sample(0.05, 0.6), sample(0.1, 0.3)])).toEqual([]);
  });

  it('merges onsets closer together than the minimum spacing, keeping the stronger', () => {
    const onsets = buildOnsetEnvelope([
      sample(0, 0),
      sample(0.05, 0.9),
      sample(0.1, 0.1),
      sample(0.15, 0.8),
      sample(0.2, 0.1),
    ]);
    expect(onsets).toHaveLength(1);
    expect(onsets[0]).toMatchObject({ time: 50 });
  });

  it('ignores malformed samples and needs at least three points', () => {
    expect(buildOnsetEnvelope([sample(0, 0.1), sample(0.05, 0.9)])).toEqual([]);
    expect(
      buildOnsetEnvelope([
        sample(Number.NaN, 1),
        sample(0.05, 0.9),
        sample(0.1, 0.1),
        sample(0.15, 0.8),
        sample(0.2, 0.1),
      ])
    ).toHaveLength(1);
  });
});

describe('estimateLyricOffset', () => {
  it('recovers a consistent positive shift', () => {
    const estimate = estimateLyricOffset(LINES, atShift(400));

    expect(estimate).not.toBeNull();
    expect(estimate!.offsetMs).toBe(400);
    expect(estimate!.matchedLines).toBe(8);
    expect(estimate!.confidence).toBeGreaterThanOrEqual(0.6);
  });

  it('recovers a consistent negative shift', () => {
    expect(estimateLyricOffset(LINES, atShift(-300))?.offsetMs).toBe(-300);
  });

  it('picks the nearest onset when several are in the match window', () => {
    const onsets = LINES.flatMap((line) => [onset(line - 600), onset(line + 400)]);
    expect(estimateLyricOffset(LINES, onsets)?.offsetMs).toBe(400);
  });

  it('tolerates a few outlier lines', () => {
    const onsets = [
      ...atShift(400).slice(0, 6),
      onset(LINES[6] - 400),
      onset(LINES[7] + 1000),
    ];
    const estimate = estimateLyricOffset(LINES, onsets);
    expect(estimate?.offsetMs).toBe(400);
    expect(estimate?.matchedLines).toBe(6);
  });

  it('rejects a zero or negligible shift', () => {
    expect(estimateLyricOffset(LINES, atShift(0))).toBeNull();
    expect(estimateLyricOffset(LINES, atShift(80))).toBeNull();
  });

  it('rejects inconsistent onsets', () => {
    const onsets = LINES.map((line, index) => onset(line + (index % 2 === 0 ? 900 : -900)));
    expect(estimateLyricOffset(LINES, onsets)).toBeNull();
  });

  it('rejects shifts beyond the allowed maximum', () => {
    expect(estimateLyricOffset(LINES, atShift(1700), { matchWindowMs: 2000 })).toBeNull();
  });

  it('rejects weak onsets', () => {
    const onsets = LINES.map((line) => onset(line + 400, 0.1));
    expect(estimateLyricOffset(LINES, onsets)).toBeNull();
  });

  it('needs enough lyric lines and enough matched lines', () => {
    expect(estimateLyricOffset(LINES.slice(0, 7), atShift(400, LINES.slice(0, 7)))).toBeNull();
    expect(estimateLyricOffset(LINES, atShift(400).slice(0, 4))).toBeNull();
  });

  it('deduplicates repeated line timestamps', () => {
    const lines = [10000, 10000, 15000, 20000, 25000, 30000, 35000, 40000, 45000];
    expect(estimateLyricOffset(lines, atShift(400, lines))?.offsetMs).toBe(400);
  });

  it('ignores non-finite times', () => {
    const lines = [...LINES, Number.NaN];
    expect(estimateLyricOffset(lines, atShift(400))?.offsetMs).toBe(400);
  });
});

describe('shiftLyricLines', () => {
  it('shifts line and word times together', () => {
    const [line] = parseLyrics('[00:10.000]hello world');
    const [shifted] = shiftLyricLines([line], 500);

    expect(shifted.time).toBe(10500);
    expect(shifted.words.map((word) => word.time)).toEqual(
      line.words.map((word) => word.time + 500)
    );
  });

  it('clamps times at zero and leaves untimed words alone', () => {
    const shifted = shiftLyricLines(
      [{ time: 200, text: 'x', words: [{ text: 'x', time: -1 }] }],
      -500
    );
    expect(shifted[0].time).toBe(0);
    expect(shifted[0].words[0].time).toBe(-1);
  });

  it('returns the same array for a zero or invalid offset', () => {
    const lines = parseLyrics('[00:10.000]hello');
    expect(shiftLyricLines(lines, 0)).toBe(lines);
    expect(shiftLyricLines(lines, Number.NaN)).toBe(lines);
  });
});
