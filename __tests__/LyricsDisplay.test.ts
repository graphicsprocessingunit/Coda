import {
  parseSyncedLyrics,
  findActiveLineIndex,
  LyricLine,
} from '../src/components/LyricsDisplay';

describe('parseSyncedLyrics', () => {
  it('parses basic line-level timestamps', () => {
    const raw = [
      '[00:00.15] Is this the real life?',
      "[01:02.50] Caught in a landslide",
    ].join('\n');
    expect(parseSyncedLyrics(raw)).toEqual([
      { time: 150, text: 'Is this the real life?' },
      { time: 62500, text: 'Caught in a landslide' },
    ]);
  });

  it('handles lines without fractional seconds', () => {
    const raw = '[00:01] no fraction';
    expect(parseSyncedLyrics(raw)).toEqual([{ time: 1000, text: 'no fraction' }]);
  });

  it('expands multi-timestamp lines to repeated lyrics', () => {
    const raw = '[00:10.00][00:20.00] Na na na na na';
    expect(parseSyncedLyrics(raw)).toEqual([
      { time: 10000, text: 'Na na na na na' },
      { time: 20000, text: 'Na na na na na' },
    ]);
  });

  it('applies [offset:] to every timestamp', () => {
    const raw = [
      '[offset:+500]',
      '[00:10.00] shifted line',
    ].join('\n');
    expect(parseSyncedLyrics(raw)).toEqual([{ time: 9500, text: 'shifted line' }]);
  });

  it('applies negative [offset:] by shifting later', () => {
    const raw = ['[offset:-250]', '[00:10.00] later line'].join('\n');
    expect(parseSyncedLyrics(raw)).toEqual([{ time: 10250, text: 'later line' }]);
  });

  it('strips enhanced-LRC word tags from the displayed text', () => {
    const raw = '[00:12.00] Start <00:12.05>the <00:12.40>song';
    expect(parseSyncedLyrics(raw)).toEqual([{ time: 12000, text: 'Start the song' }]);
  });

  it('ignores timestamp-less metadata and empty lines', () => {
    const raw = [
      '[ti:Some Song]',
      '[ar:An Artist]',
      '',
      '[00:05.00] real line',
    ].join('\n');
    expect(parseSyncedLyrics(raw)).toEqual([{ time: 5000, text: 'real line' }]);
  });

  it('returns lines sorted ascending regardless of input order', () => {
    const raw = [
      '[00:30.00] third',
      '[00:00.00] first',
      '[00:15.00] second',
    ].join('\n');
    const lines = parseSyncedLyrics(raw);
    expect(lines.map((l) => l.time)).toEqual([0, 15000, 30000]);
    expect(lines.map((l) => l.text)).toEqual(['first', 'second', 'third']);
  });
});

describe('findActiveLineIndex', () => {
  const lines: LyricLine[] = [
    { time: 1000, text: 'one' },
    { time: 5000, text: 'two' },
    { time: 9000, text: 'three' },
  ];

  it('returns -1 before the first line', () => {
    expect(findActiveLineIndex(lines, 999)).toBe(-1);
  });

  it('activates exactly at a line timestamp (0ms offset)', () => {
    expect(findActiveLineIndex(lines, 1000)).toBe(0);
  });

  it('holds the current line during a gap', () => {
    expect(findActiveLineIndex(lines, 8500)).toBe(1);
  });

  it('switches to the next line at its exact boundary', () => {
    expect(findActiveLineIndex(lines, 9000)).toBe(2);
  });

  it('returns the last line after the final timestamp', () => {
    expect(findActiveLineIndex(lines, 600000)).toBe(2);
  });

  it('handles an empty list', () => {
    expect(findActiveLineIndex([], 1000)).toBe(-1);
  });

  it('resolves the greatest timestamp at an exact boundary with duplicates', () => {
    const dup = [
      { time: 1000, text: 'a' },
      { time: 1000, text: 'a' },
      { time: 2000, text: 'b' },
    ];
    expect(findActiveLineIndex(dup, 1000)).toBe(1);
  });
});