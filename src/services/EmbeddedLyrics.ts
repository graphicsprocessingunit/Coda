import { File } from 'expo-file-system';

import { formatLrcTimestamp } from '../utils/lyrics';
import type { LyricsResult } from './LyricsService';

/**
 * Lyrics shipped with the audio file itself: a sibling `.lrc`, an ID3 `USLT`
 * (untimed) or `SYLT` (timed) frame, or the MP4/M4A `©lyr` atom. Timed content
 * is converted to LRC so the player's parser and karaoke view work unchanged.
 */

const MAX_TAG_BYTES = 4 * 1024 * 1024;
const HEAD_BYTES = 1024 * 1024;
const TAIL_BYTES = 2 * 1024 * 1024;

const MP4_LYRIC_ATOM = [0xa9, 0x6c, 0x79, 0x72]; // ©lyr

export interface EmbeddedTag {
  lyrics: string;
  synced: boolean;
}

function synchsafeToInt(bytes: Uint8Array, offset: number): number {
  return (
    ((bytes[offset] & 0x7f) << 21) |
    ((bytes[offset + 1] & 0x7f) << 14) |
    ((bytes[offset + 2] & 0x7f) << 7) |
    (bytes[offset + 3] & 0x7f)
  );
}

function uint32ToInt(bytes: Uint8Array, offset: number): number {
  return (
    ((bytes[offset] << 24) | (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3]) >>>
    0
  );
}

function chunks(units: number[]): string {
  let out = '';
  const CHUNK = 8192;
  for (let i = 0; i < units.length; i += CHUNK) {
    out += String.fromCharCode(...units.slice(i, i + CHUNK));
  }
  return out;
}

function decodeLatin1(bytes: Uint8Array): string {
  return chunks(Array.from(bytes));
}

function decodeUtf16(bytes: Uint8Array, defaultLittleEndian: boolean): string {
  let offset = 0;
  let littleEndian = defaultLittleEndian;
  if (bytes.length >= 2) {
    if (bytes[0] === 0xff && bytes[1] === 0xfe) {
      littleEndian = true;
      offset = 2;
    } else if (bytes[0] === 0xfe && bytes[1] === 0xff) {
      littleEndian = false;
      offset = 2;
    }
  }
  const units: number[] = [];
  for (let i = offset; i + 1 < bytes.length; i += 2) {
    units.push(littleEndian ? bytes[i] | (bytes[i + 1] << 8) : (bytes[i] << 8) | bytes[i + 1]);
  }
  return chunks(units);
}

/** ID3 text encodings; Hermes has no TextDecoder, so UTF-8 is decoded by hand. */
function decodeUtf8(bytes: Uint8Array): string {
  const units: number[] = [];
  let i = 0;
  while (i < bytes.length) {
    const first = bytes[i++];
    if (first < 0x80) {
      units.push(first);
      continue;
    }
    let extra = 0;
    let codePoint = 0;
    if (first >= 0xf0) {
      extra = 3;
      codePoint = first & 0x07;
    } else if (first >= 0xe0) {
      extra = 2;
      codePoint = first & 0x0f;
    } else if (first >= 0xc0) {
      extra = 1;
      codePoint = first & 0x1f;
    } else {
      units.push(0xfffd);
      continue;
    }
    if (i + extra > bytes.length) break;
    for (let j = 0; j < extra; j++) {
      codePoint = (codePoint << 6) | (bytes[i++] & 0x3f);
    }
    if (codePoint > 0xffff) {
      const value = codePoint - 0x10000;
      units.push(0xd800 + (value >> 10), 0xdc00 + (value & 0x3ff));
    } else {
      units.push(codePoint);
    }
  }
  return chunks(units);
}

function decodeId3Text(bytes: Uint8Array, encoding: number): string {
  switch (encoding) {
    case 1:
      return decodeUtf16(bytes, true);
    case 2:
      return decodeUtf16(bytes, false);
    case 3:
      return decodeUtf8(bytes);
    default:
      return decodeLatin1(bytes);
  }
}

function removeUnsynchronisation(bytes: Uint8Array): Uint8Array {
  const output = new Uint8Array(bytes.length);
  let length = 0;
  for (let i = 0; i < bytes.length; i++) {
    output[length++] = bytes[i];
    if (bytes[i] === 0xff && bytes[i + 1] === 0x00) i++;
  }
  return output.subarray(0, length);
}

/** Read a null-terminated ID3 string starting at `start`. */
function readId3String(
  data: Uint8Array,
  start: number,
  encoding: number
): { text: string; next: number } | null {
  let offset = start;
  if (encoding === 1 || encoding === 2) {
    while (offset + 1 < data.length && !(data[offset] === 0 && data[offset + 1] === 0)) {
      offset += 2;
    }
    if (offset + 1 >= data.length) return null;
    return { text: decodeId3Text(data.subarray(start, offset), encoding), next: offset + 2 };
  }
  while (offset < data.length && data[offset] !== 0) offset++;
  if (offset >= data.length) return null;
  return { text: decodeId3Text(data.subarray(start, offset), encoding), next: offset + 1 };
}

function decodeUslt(data: Uint8Array): string | null {
  if (data.length < 5) return null;
  const descriptor = readId3String(data, 4, data[0]);
  if (!descriptor) return null;
  const text = decodeId3Text(data.subarray(descriptor.next), data[0])
    .replace(/\u0000+$/g, '')
    .trim();
  return text.length > 0 ? text : null;
}

/**
 * SYLT entries are (text, 4-byte timestamp) pairs. Timestamps can be MPEG
 * frames or milliseconds; only milliseconds can be converted to LRC without
 * knowing the frame duration, so other formats are skipped.
 */
function decodeSylt(data: Uint8Array): string | null {
  if (data.length < 6) return null;
  const encoding = data[0];
  const timestampFormat = data[4];
  if (timestampFormat !== 2) return null;

  const descriptor = readId3String(data, 6, encoding);
  if (!descriptor) return null;

  const lines: string[] = [];
  let offset = descriptor.next;
  while (offset < data.length) {
    const entry = readId3String(data, offset, encoding);
    if (!entry) break;
    offset = entry.next;
    if (offset + 4 > data.length) break;
    const time = uint32ToInt(data, offset);
    offset += 4;
    const text = entry.text.trim();
    if (text.length > 0) lines.push(`${formatLrcTimestamp(time)}${text}`);
  }

  return lines.length > 0 ? lines.join('\n') : null;
}

/**
 * Extract lyrics from an ID3v2.3/v2.4 tag. Timed `SYLT` wins over untimed
 * `USLT`; some taggers also store LRC text in USLT, which is returned as-is.
 */
export function parseId3Tag(bytes: Uint8Array): EmbeddedTag | null {
  if (bytes.length < 10) return null;
  if (bytes[0] !== 0x49 || bytes[1] !== 0x44 || bytes[2] !== 0x33) return null;

  const version = bytes[3];
  if (version < 3 || version > 4) return null;

  const headerFlags = bytes[5];
  const tagSize = synchsafeToInt(bytes, 6);
  const end = Math.min(bytes.length, 10 + tagSize, MAX_TAG_BYTES);
  let body = bytes.subarray(10, end);
  if (headerFlags & 0x80) body = removeUnsynchronisation(body);

  let position = 0;
  if (headerFlags & 0x40) {
    if (body.length < 4) return null;
    position = version === 4 ? synchsafeToInt(body, 0) : 4 + uint32ToInt(body, 0);
  }

  let sylt: string | null = null;
  let uslt: string | null = null;

  while (position + 10 <= body.length) {
    if (body[position] === 0) break;

    const id = String.fromCharCode(
      body[position],
      body[position + 1],
      body[position + 2],
      body[position + 3]
    );
    const size = version === 4 ? synchsafeToInt(body, position + 4) : uint32ToInt(body, position + 4);
    const frameFlags = body[position + 8];
    const dataStart = position + 10;
    const dataEnd = Math.min(body.length, dataStart + size);
    if (size <= 0 || dataEnd <= dataStart) break;

    let data = body.subarray(dataStart, dataEnd);
    if (version === 4 && frameFlags & 0x02) data = removeUnsynchronisation(data);
    if (version === 4 && frameFlags & 0x01 && data.length >= 4) data = data.subarray(4);

    if (id === 'SYLT' && !sylt) sylt = decodeSylt(data);
    if (id === 'USLT' && !uslt) uslt = decodeUslt(data);

    position = dataEnd;
  }

  if (sylt) return { lyrics: sylt, synced: true };
  if (uslt) return { lyrics: uslt, synced: false };
  return null;
}

/** Legacy helper: the embedded lyrics text, timed or not. */
export function parseId3Lyrics(bytes: Uint8Array): string | null {
  return parseId3Tag(bytes)?.lyrics ?? null;
}

function indexOfBytes(haystack: Uint8Array, needle: readonly number[], from = 0): number {
  outer: for (let i = from; i <= haystack.length - needle.length; i++) {
    for (let j = 0; j < needle.length; j++) {
      if (haystack[i + j] !== needle[j]) continue outer;
    }
    return i;
  }
  return -1;
}

/**
 * Read the `©lyr` atom from an MP4/M4A file. The atom wraps a `data` box whose
 * payload is UTF-8 (type 1) or UTF-16 (type 2) text.
 */
export function parseMp4Lyrics(bytes: Uint8Array): string | null {
  const index = indexOfBytes(bytes, MP4_LYRIC_ATOM);
  if (index < 0) return null;

  const dataStart = index + 4;
  if (dataStart + 16 > bytes.length) return null;

  const dataSize = uint32ToInt(bytes, dataStart);
  if (dataSize < 16) return null;

  const type = String.fromCharCode(
    bytes[dataStart + 4],
    bytes[dataStart + 5],
    bytes[dataStart + 6],
    bytes[dataStart + 7]
  );
  if (type !== 'data') return null;

  const dataEnd = dataStart + dataSize;
  if (dataEnd > bytes.length) return null;

  // The data box's type indicator is the last byte of its version/flags word;
  // the following four bytes are the locale.
  const dataType = bytes[dataStart + 11];
  const payload = bytes.subarray(dataStart + 16, dataEnd);
  const text = (dataType === 2 ? decodeUtf16(payload, false) : decodeUtf8(payload))
    .replace(/\u0000+$/g, '')
    .trim();
  return text.length > 0 ? text : null;
}

function sidecarUri(uri: string): string {
  const clean = uri.split('?')[0].split('#')[0];
  const dot = clean.lastIndexOf('.');
  const slash = clean.lastIndexOf('/');
  return dot > slash ? `${clean.slice(0, dot)}.lrc` : `${clean}.lrc`;
}

/** Read a byte range, falling back to the whole file where handles are absent. */
async function readFileRange(file: File, start: number, length: number): Promise<Uint8Array> {
  try {
    const handle = file.open();
    try {
      handle.offset = start;
      return handle.readBytes(length);
    } finally {
      handle.close();
    }
  } catch {
    const all = await file.bytes();
    return all.subarray(start, start + length);
  }
}

/**
 * Look for lyrics shipped with a local audio file: a sibling `.lrc` first, then
 * tags embedded in the container. Remote URLs are skipped; the caller already
 * answered those.
 */
export async function readEmbeddedLyrics(uri: string): Promise<LyricsResult | null> {
  if (!uri || /^(https?|navidrome):/i.test(uri)) return null;

  try {
    const sidecar = new File(sidecarUri(uri));
    if (sidecar.exists) {
      const text = (await sidecar.text()).trim();
      if (text.length > 0) return { lyrics: text };
    }
  } catch {
    // No sidecar or unreadable file; try the tags next.
  }

  try {
    const file = new File(uri);
    if (!file.exists) return null;

    const headLength = Math.min(file.size, HEAD_BYTES);
    const head = await readFileRange(file, 0, headLength);
    const id3 = parseId3Tag(head);
    if (id3) return { lyrics: id3.lyrics };

    const headMp4 = parseMp4Lyrics(head);
    if (headMp4) return { lyrics: headMp4 };

    // Some M4A files keep the metadata at the end of the file.
    if (file.size > HEAD_BYTES) {
      const tailStart = Math.max(HEAD_BYTES, file.size - TAIL_BYTES);
      const tail = await readFileRange(file, tailStart, file.size - tailStart);
      const tailMp4 = parseMp4Lyrics(tail);
      if (tailMp4) return { lyrics: tailMp4 };
    }

    return null;
  } catch {
    return null;
  }
}
