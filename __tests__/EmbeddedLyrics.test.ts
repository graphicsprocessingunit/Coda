import { File } from 'expo-file-system';

import {
  parseId3Lyrics,
  parseId3Tag,
  parseMp4Lyrics,
  readEmbeddedLyrics,
} from '../src/services/EmbeddedLyrics';

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

function syltData(
  pairs: { time: number; text: string }[],
  encoding = 3,
  timestampFormat = 2
): number[] {
  const descriptor = encoding === 1 || encoding === 2 ? [0, 0] : [0];
  const body: number[] = [encoding, 0x65, 0x6e, 0x67, timestampFormat, 1, ...descriptor];
  for (const pair of pairs) {
    body.push(...utf8(pair.text), 0, ...be32(pair.time));
  }
  return body;
}

function tagWithLyrics(encoding: number, text: number[], version: 3 | 4 = 3): Uint8Array {
  return buildTag([frame('USLT', usltData(encoding, text), version)], version);
}

function mp4Box(type: string, payload: number[]): number[] {
  return [
    ...be32(8 + payload.length),
    ...Array.from(type).map((char) => char.charCodeAt(0)),
    ...payload,
  ];
}

function mp4Lyrics(value: string, dataType = 1): Uint8Array {
  const text =
    dataType === 2 ? [0xff, 0xfe, ...Array.from(Buffer.from(value, 'utf16le'))] : utf8(value);
  return new Uint8Array(
    mp4Box('\u00a9lyr', mp4Box('data', [0, 0, 0, dataType, 0, 0, 0, 0, ...text]))
  );
}

beforeEach(() => {
  (require('expo-file-system') as { __reset?: () => void }).__reset?.();
});

describe('parseId3Lyrics (USLT)', () => {
  it('reads UTF-8 lyrics, including LRC-timed content', () => {
    const tag = tagWithLyrics(3, utf8('[00:01.00] Embedded\n[00:03.00] Second'));
    expect(parseId3Lyrics(tag)).toBe('[00:01.00] Embedded\n[00:03.00] Second');
  });

  it('reads UTF-16 lyrics with a byte-order mark', () => {
    expect(parseId3Lyrics(tagWithLyrics(1, utf16le('Some line')))).toBe('Some line');
  });

  it('reads Latin-1 lyrics', () => {
    expect(parseId3Lyrics(tagWithLyrics(0, latin1('Café')))).toBe('Café');
  });

  it('reads ID3v2.4 tags with syncsafe frame sizes', () => {
    expect(parseId3Lyrics(tagWithLyrics(3, utf8('Version four'), 4))).toBe('Version four');
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

  it('reports untimed lyrics as unsynced', () => {
    expect(parseId3Tag(tagWithLyrics(3, utf8('plain')))).toEqual({
      lyrics: 'plain',
      synced: false,
    });
  });

  it('returns null when there is no USLT frame', () => {
    expect(parseId3Lyrics(buildTag([frame('TIT2', [3, ...utf8('Title')], 3)]))).toBeNull();
  });

  it('returns null for non-ID3 data and truncated tags', () => {
    expect(parseId3Lyrics(new Uint8Array([1, 2, 3, 4]))).toBeNull();
    expect(parseId3Lyrics(new Uint8Array([0x49, 0x44, 0x33, 3, 0, 0, 0, 0, 0, 100]))).toBeNull();
  });
});

describe('parseId3Lyrics (SYLT)', () => {
  it('converts millisecond SYLT entries to LRC', () => {
    const tag = buildTag([
      frame(
        'SYLT',
        syltData([
          { time: 500, text: 'Hello' },
          { time: 2000, text: 'World' },
        ]),
        3
      ),
    ]);

    expect(parseId3Tag(tag)).toEqual({
      lyrics: '[00:00.500]Hello\n[00:02.000]World',
      synced: true,
    });
  });

  it('prefers timed SYLT over untimed USLT', () => {
    const tag = buildTag([
      frame('USLT', usltData(3, utf8('untimed text')), 3),
      frame('SYLT', syltData([{ time: 1200, text: 'timed' }]), 3),
    ]);

    expect(parseId3Tag(tag)).toEqual({ lyrics: '[00:01.200]timed', synced: true });
  });

  it('ignores MPEG-frame timestamps and falls back to USLT', () => {
    const tag = buildTag([
      frame('SYLT', syltData([{ time: 40, text: 'frame based' }], 3, 1), 3),
      frame('USLT', usltData(3, utf8('fallback text')), 3),
    ]);

    expect(parseId3Tag(tag)).toEqual({ lyrics: 'fallback text', synced: false });
  });
});

describe('parseMp4Lyrics', () => {
  it('reads UTF-8 ©lyr atoms', () => {
    expect(parseMp4Lyrics(mp4Lyrics('[00:01.00] M4A line'))).toBe('[00:01.00] M4A line');
  });

  it('reads UTF-16 ©lyr atoms', () => {
    expect(parseMp4Lyrics(mp4Lyrics('Wide text', 2))).toBe('Wide text');
  });

  it('returns null when the atom is absent', () => {
    expect(parseMp4Lyrics(new Uint8Array(mp4Box('ftyp', [0, 0, 0, 0])))).toBeNull();
  });

  it('returns null when the atom is truncated', () => {
    const bytes = mp4Lyrics('truncated');
    expect(parseMp4Lyrics(bytes.subarray(0, bytes.length - 4))).toBeNull();
  });
});

describe('readEmbeddedLyrics', () => {
  it('reads the embedded tag from a local file', async () => {
    new File('file:///mock-documents/song.mp3').write(tagWithLyrics(3, utf8('[00:01.00] File')));

    await expect(readEmbeddedLyrics('file:///mock-documents/song.mp3')).resolves.toEqual({
      lyrics: '[00:01.00] File',
    });
  });

  it('reads lyrics from an M4A file', async () => {
    new File('file:///mock-documents/song.m4a').write(mp4Lyrics('M4A lyrics'));

    await expect(readEmbeddedLyrics('file:///mock-documents/song.m4a')).resolves.toEqual({
      lyrics: 'M4A lyrics',
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
