import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import { gcm } from '@noble/ciphers/aes.js';

const KEY_STORE = '@coda_encryption_key';
const VERSION = 'v1';
const NONCE_LENGTH = 12;
const TAG_LENGTH = 16;

const B64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

let cachedKey: Uint8Array | null = null;

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function utf8Encode(str: string): Uint8Array {
  const bytes: number[] = [];
  for (let i = 0; i < str.length; i++) {
    let codePoint = str.codePointAt(i)!;
    if (codePoint > 0xffff) i++;
    if (codePoint <= 0x7f) {
      bytes.push(codePoint);
    } else if (codePoint <= 0x7ff) {
      bytes.push(0xc0 | (codePoint >> 6), 0x80 | (codePoint & 0x3f));
    } else if (codePoint <= 0xffff) {
      bytes.push(0xe0 | (codePoint >> 12), 0x80 | ((codePoint >> 6) & 0x3f), 0x80 | (codePoint & 0x3f));
    } else {
      bytes.push(
        0xf0 | (codePoint >> 18),
        0x80 | ((codePoint >> 12) & 0x3f),
        0x80 | ((codePoint >> 6) & 0x3f),
        0x80 | (codePoint & 0x3f),
      );
    }
  }
  return new Uint8Array(bytes);
}

function utf8Decode(bytes: Uint8Array): string {
  let result = '';
  let i = 0;
  while (i < bytes.length) {
    const byte = bytes[i];
    if (byte <= 0x7f) {
      result += String.fromCharCode(byte);
      i += 1;
    } else if (byte >= 0xc0 && byte <= 0xdf) {
      result += String.fromCharCode(((byte & 0x1f) << 6) | (bytes[i + 1] & 0x3f));
      i += 2;
    } else if (byte >= 0xe0 && byte <= 0xef) {
      result += String.fromCharCode(
        ((byte & 0x0f) << 12) | ((bytes[i + 1] & 0x3f) << 6) | (bytes[i + 2] & 0x3f),
      );
      i += 3;
    } else {
      const codePoint =
        ((byte & 0x07) << 18) | ((bytes[i + 1] & 0x3f) << 12) | ((bytes[i + 2] & 0x3f) << 6) | (bytes[i + 3] & 0x3f);
      result += String.fromCodePoint(codePoint);
      i += 4;
    }
  }
  return result;
}

export class CryptoService {
  static async getOrCreateKey(): Promise<Uint8Array> {
    if (cachedKey) return cachedKey;
    let raw = await SecureStore.getItemAsync(KEY_STORE);
    if (raw) {
      cachedKey = base64ToBytes(raw);
      return cachedKey;
    }
    const key = Crypto.getRandomBytes(32);
    await SecureStore.setItemAsync(KEY_STORE, bytesToBase64(key));
    cachedKey = key;
    return key;
  }

  static async encrypt(plaintext: string): Promise<string> {
    const key = await this.getOrCreateKey();
    const nonce = Crypto.getRandomBytes(NONCE_LENGTH);
    const ciphertext = gcm(key, nonce).encrypt(utf8Encode(plaintext));
    const payload = new Uint8Array(NONCE_LENGTH + ciphertext.length);
    payload.set(nonce, 0);
    payload.set(ciphertext, NONCE_LENGTH);
    return `${VERSION}:${bytesToBase64(payload)}`;
  }

  static async decrypt(payload: string): Promise<string> {
    const separator = payload.indexOf(':');
    const version = separator > 0 ? payload.slice(0, separator) : '';
    const b64 = separator > 0 ? payload.slice(separator + 1) : '';
    if (version !== VERSION || !b64) throw new Error('Invalid encrypted payload');
    const data = base64ToBytes(b64);
    if (data.length < NONCE_LENGTH + TAG_LENGTH) throw new Error('Invalid encrypted payload');
    const nonce = data.slice(0, NONCE_LENGTH);
    const ciphertext = data.slice(NONCE_LENGTH);
    const key = await this.getOrCreateKey();
    const plaintext = gcm(key, nonce).decrypt(ciphertext);
    return utf8Decode(plaintext);
  }
}
