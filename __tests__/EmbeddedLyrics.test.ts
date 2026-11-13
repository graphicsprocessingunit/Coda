import { File } from 'expo-file-system';

import { parseId3Lyrics, readEmbeddedLyrics } from '../src/services/EmbeddedLyrics';

function synchsafe(value: number): number[] {
  return [(value >> 21) & 0x7f, (value >> 14) & 0x7f, (value >> 7) & 0x7f, value & 0x7f];
}

function be32(value: number): number[] {
  return [(value >>> 24) & 0xff, (value >>> 16) & 0xff, (value >>> 8) & 0xff, value & 0xff];
}

function frame(id: string, data: number[], version: 3 | 4): number[] {
  const size = version === 4 ? synchsafe(data.length) : be32(data.length);
  return [...Array.from(id).map((char) => char.charCodeAt(0)), ...size, 0, 0, ...data];
}

function buildTag(frames: number[][], version: 3 | 4 = 3): Uint8Array {
  const body = frames.flat();
  return new Uint8Array([0x49, 0x44, 0x33, version, 0x00, 0x00, ...synchsafe(body.length), ...body]);
}

function utf8(value: string): number[] {
  return Array.from(Buffer.from(value, 'utf8'));
}

function latin1(value: string): number[] {
  return Array.from(Buffer.from(value, 'latin1'));
}

function utf16le(value: string): number[] {
  return [0xff, 0xfe, ...Array.from(Buffer.from(value, 'utf16le'))];
}

function usltData(encoding: number, text: number[]): number[] {
  const descriptor = encoding === 1 || encoding === 2 ? [0, 0] : [0];
  return [encoding, 0x65, 0x6e, 0x67, ...descriptor, ...text];
}

function tagWithLyrics(encoding: number, text: number[], version: 3 | 4 = 3): Uint8Array {
  return buildTag([frame('USLT', usltData(encoding, text), version)], version);
}

beforeEach(() => {
  (require('expo-file-system') as { __reset?: () => void }).__reset?.();
});

describe('parseId3Lyrics', () => {
  it('reads UTF-8 USLT lyrics, including LRC-timed content', () => {
    const tag = tagWithLyrics(3, utf8('[00:01.00] Embedded\n[00:03.00] Second'));
    expect(parseId3Lyrics(tag)).toBe('[00:01.00] Embedded\n[00:03.00] Second');
  });

  it('reads UTF-16 lyrics with a byte-order mark', () => {
    const tag = tagWithLyrics(1, utf16le('Some line'));
    expect(parseId3Lyrics(tag)).toBe('Some line');
  });

  it('reads Latin-1 lyrics', () => {
    const tag = tagWithLyrics(0, latin1('Café'));
    expect(parseId3Lyrics(tag)).toBe('Café');
  });

  it('reads ID3v2.4 tags with syncsafe frame sizes', () => {
    const tag = tagWithLyrics(3, utf8('Version four'), 4);
    expect(parseId3Lyrics(tag)).toBe('Version four');
  });

  it('skips other frames and finds USLT later in the tag', () => {
    const tag = buildTag([
      frame('TIT2', [3, ...utf8('Title')], 3),
      frame('TPE1', [3, ...utf8('Artist')], 3),
      frame('USLT', usltData(3, utf8('Lyrics')), 3),
    ]);
    expect(parseId3Lyrics(tag)).toBe('Lyrics');
  });

  it('returns the first non-empty USLT frame', () => {
    const tag = buildTag([
      frame('USLT', usltData(3, utf8('   ')), 3),
      frame('USLT', usltData(3, utf8('Second frame')), 3),
    ]);
    expect(parseId3Lyrics(tag)).toBe('Second frame');
  });

  it('returns null when there is no USLT frame', () => {
    const tag = buildTag([frame('TIT2', [3, ...utf8('Title')], 3)]);
    expect(parseId3Lyrics(tag)).toBeNull();
  });

  it('returns null for non-ID3 data and truncated tags', () => {
    expect(parseId3Lyrics(new Uint8Array([1, 2, 3, 4]))).toBeNull();
    expect(parseId3Lyrics(new Uint8Array([0x49, 0x44, 0x33, 3, 0, 0, 0, 0, 0, 100]))).toBeNull();
  });
});

describe('readEmbeddedLyrics', () => {
  it('reads the embedded tag from a local file', async () => {
    new File('file:///mock-documents/song.mp3').write(tagWithLyrics(3, utf8('[00:01.00] File')));

    await expect(readEmbeddedLyrics('file:///mock-documents/song.mp3')).resolves.toEqual({
      lyrics: '[00:01.00] File',
    });
  });

  it('prefers an .lrc sidecar next to the file', async () => {
    new File('file:///mock-documents/song.mp3').write(tagWithLyrics(3, utf8('Embedded')));
    new File('file:///mock-documents/song.lrc').write('[00:02.00] Sidecar');

    await expect(readEmbeddedLyrics('file:///mock-documents/song.mp3')).resolves.toEqual({
      lyrics: '[00:02.00] Sidecar',
    });
  });

  it('returns null when nothing local carries lyrics', async () => {
    new File('file:///mock-documents/plain.mp3').write('not an id3 tag');

    await expect(readEmbeddedLyrics('file:///mock-documents/plain.mp3')).resolves.toBeNull();
  });

  it('skips remote URLs', async () => {
    await expect(readEmbeddedLyrics('https://example.com/song.mp3')).resolves.toBeNull();
  });
});
