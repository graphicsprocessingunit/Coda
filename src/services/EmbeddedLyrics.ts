import { File } from 'expo-file-system';

import type { LyricsResult } from './LyricsService';

/**
 * Lyrics that live next to the audio instead of online: a `.lrc` sidecar file,
 * or the ID3 `USLT` (unsynchronised lyrics) frame embedded in the file. Some
 * taggers store timed LRC text in USLT, so that content is returned unchanged
 * and the player will sync it.
 */

const MAX_TAG_BYTES = 4 * 1024 * 1024;

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
    units.push(
      littleEndian ? bytes[i] | (bytes[i + 1] << 8) : (bytes[i] << 8) | bytes[i + 1]
    );
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

function decodeUslt(data: Uint8Array): string | null {
  if (data.length < 5) return null;
  const encoding = data[0];
  let offset = 4; // encoding byte + language

  if (encoding === 1 || encoding === 2) {
    while (offset + 1 < data.length && !(data[offset] === 0 && data[offset + 1] === 0)) {
      offset += 2;
    }
    offset += 2;
  } else {
    while (offset < data.length && data[offset] !== 0) offset++;
    offset++;
  }

  if (offset >= data.length) return null;
  const text = decodeId3Text(data.subarray(offset), encoding)
    .replace(/\u0000+$/g, '')
    .trim();
  return text.length > 0 ? text : null;
}

/**
 * Extract the first `USLT` frame from an ID3v2.3/v2.4 tag. Returns null for
 * other media containers, missing lyrics, or malformed tags.
 */
export function parseId3Lyrics(bytes: Uint8Array): string | null {
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

    if (id === 'USLT') {
      const text = decodeUslt(data);
      if (text) return text;
    }

    position = dataEnd;
  }

  return null;
}

function sidecarUri(uri: string): string {
  const clean = uri.split('?')[0].split('#')[0];
  const dot = clean.lastIndexOf('.');
  const slash = clean.lastIndexOf('/');
  return dot > slash ? `${clean.slice(0, dot)}.lrc` : `${clean}.lrc`;
}

/**
 * Look for lyrics shipped with a local audio file: a sibling `.lrc` first,
 * then the embedded ID3 tag. Remote URLs are skipped; the caller already
 * answered those from LRCLIB.
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
    // No sidecar or unreadable file; try the embedded tag next.
  }

  try {
    const file = new File(uri);
    if (!file.exists) return null;
    const lyrics = parseId3Lyrics(await file.bytes());
    return lyrics ? { lyrics } : null;
  } catch {
    return null;
  }
}
