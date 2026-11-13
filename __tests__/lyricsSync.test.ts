import {
  applyDurationScale,
  estimateSyllables,
  findActiveWordIndex,
  parseLyrics,
} from '../src/utils/lyrics';

describe('parseLyrics word timings', () => {
  it('uses enhanced-LRC word tags when present', () => {
    const [line] = parseLyrics('[00:12.00] Start <00:12.05>the <00:12.40>song');
    expect(line.words).toEqual([
      { text: 'Start', time: 12000 },
      { text: 'the', time: 12050 },
      { text: 'song', time: 12400 },
    ]);
  });

  it('interpolates word times across a line, weighted by syllables', () => {
    const lines = parseLyrics('[00:00.00] one beautiful day\n[00:04.00] next line');
    const words = lines[0].words;

    expect(words[0].time).toBe(0);
    expect(words[2].time).toBeGreaterThan(words[1].time);
    expect(words[2].time).toBeLessThan(4000);
  });

  it('keeps timings monotonic', () => {
    const [line] = parseLyrics('[00:05.00] a b c d e');
    const times = line.words.map((word) => word.time);
    expect(times).toEqual([...times].sort((a, b) => a - b));
    expect(times[0]).toBe(5000);
  });

  it('applies the offset tag once to both lines and words', () => {
    const [line] = parseLyrics('[offset:+500]\n[00:10.00] a b');
    expect(line.time).toBe(9500);
    expect(line.words[0].time).toBe(9500);
  });

  it('shifts word timings for repeated timestamps', () => {
    const lines = parseLyrics('[00:10.00][00:20.00] na na');
    expect(lines.map((line) => line.time)).toEqual([10000, 20000]);
    expect(lines[1].words[0].time).toBe(20000);
  });

  it('gives the last line a bounded duration', () => {
    const [line] = parseLyrics('[00:10.00] closing line');
    expect(line.words[line.words.length - 1].time).toBeGreaterThanOrEqual(10000);
    expect(line.words[line.words.length - 1].time).toBeLessThanOrEqual(22000);
  });
});

describe('findActiveWordIndex', () => {
  const words = [
    { text: 'a', time: 0 },
    { text: 'b', time: 500 },
    { text: 'c', time: 900 },
  ];

  it('returns -1 before the first word', () => {
    expect(findActiveWordIndex([{ text: 'a', time: 100 }], 50)).toBe(-1);
  });

  it('returns the last word whose time has passed', () => {
    expect(findActiveWordIndex(words, 0)).toBe(0);
    expect(findActiveWordIndex(words, 600)).toBe(1);
    expect(findActiveWordIndex(words, 5000)).toBe(2);
  });

  it('handles an empty line', () => {
    expect(findActiveWordIndex([], 100)).toBe(-1);
  });
});

describe('applyDurationScale', () => {
  const lines = parseLyrics('[00:10.00] hello <00:12.00>world');

  it('stretches timings to a longer playing edit', () => {
    const scaled = applyDurationScale(lines, 200000, 100000);
    expect(scaled[0].time).toBe(20000);
    expect(scaled[0].words[0].time).toBe(20000);
  });

  it('squashes timings to a shorter playing edit', () => {
    const scaled = applyDurationScale(lines, 50000, 100000);
    expect(scaled[0].time).toBe(5000);
  });

  it('leaves nearly identical durations untouched', () => {
    expect(applyDurationScale(lines, 100500, 100000)).toBe(lines);
  });

  it('leaves lines untouched when either duration is unknown', () => {
    expect(applyDurationScale(lines, 200000, undefined)).toBe(lines);
    expect(applyDurationScale(lines, 0, 100000)).toBe(lines);
  });
});

describe('estimateSyllables', () => {
  it('counts vowel groups', () => {
    expect(estimateSyllables('song')).toBe(1);
    expect(estimateSyllables('beautiful')).toBe(3);
  });

  it('falls back for words without vowel letters', () => {
    expect(estimateSyllables('!?')).toBeGreaterThanOrEqual(1);
    expect(estimateSyllables('東京')).toBeGreaterThanOrEqual(1);
  });
});
