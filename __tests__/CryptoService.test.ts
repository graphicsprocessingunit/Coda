import * as SecureStore from 'expo-secure-store';

function getService() {
  const { CryptoService } = require('../src/services/CryptoService');
  return CryptoService as typeof import('../src/services/CryptoService').CryptoService;
}

function getBase64() {
  const { bytesToBase64, base64ToBytes } = require('../src/services/CryptoService');
  return { bytesToBase64, base64ToBytes };
}

const originalBtoa = (global as any).btoa;
const originalAtob = (global as any).atob;

describe('CryptoService', () => {
  beforeAll(() => {
    // Hermes / React Native do NOT provide btoa/atob globals — simulate that
    // so a regression here fails loudly in CI instead of silently on device.
    delete (global as any).btoa;
    delete (global as any).atob;
  });

  afterAll(() => {
    (global as any).btoa = originalBtoa;
    (global as any).atob = originalAtob;
  });

  beforeEach(() => {
    jest.resetModules();
    const secureStore = jest.requireMock('expo-secure-store') as any;
    secureStore.deleteItemAsync('@coda_encryption_key');
  });

  it('encrypts to the v1:base64 format', async () => {
    const payload = await getService().encrypt('hunter2');
    expect(payload.startsWith('v1:')).toBe(true);
    const [, b64] = payload.split(':');
    expect(b64).toMatch(/^[A-Za-z0-9+/]+=*$/);
  });

  it('round-trips plain ASCII', async () => {
    const payload = await getService().encrypt('correct horse battery staple');
    expect(await getService().decrypt(payload)).toBe('correct horse battery staple');
  });

  it('round-trips UTF-8 (non-ASCII)', async () => {
    const text = 'héllo wörld — 🎵 ünïcode ✓';
    const payload = await getService().encrypt(text);
    expect(await getService().decrypt(payload)).toBe(text);
  });

  it('does not leak the plaintext into the ciphertext', async () => {
    const secret = 's3cr3t-passw0rd';
    const payload = await getService().encrypt(secret);
    expect(payload).not.toContain(secret);
  });

  it('produces different ciphertext for the same plaintext', async () => {
    const svc = getService();
    const a = await svc.encrypt('same value');
    const b = await svc.encrypt('same value');
    expect(a).not.toBe(b);
  });

  it('rejects tampered ciphertext', async () => {
    const { bytesToBase64, base64ToBytes } = getBase64();
    const payload = await getService().encrypt('trust me');
    const [, b64] = payload.split(':');
    const bytes = base64ToBytes(b64);
    bytes[bytes.length - 1] ^= 0xff;
    const tampered = 'v1:' + bytesToBase64(bytes);
    await expect(getService().decrypt(tampered)).rejects.toThrow();
  });

  it('rejects malformed payloads', async () => {
    const svc = getService();
    await expect(svc.decrypt('garbage')).rejects.toThrow();
    await expect(svc.decrypt('v1:abc')).rejects.toThrow();
  });

  it('stores the key once and reuses it', async () => {
    const svc = getService();
    const secureStore = jest.requireMock('expo-secure-store') as any;
    await svc.encrypt('a');
    const raw = await secureStore.getItemAsync('@coda_encryption_key');
    expect(raw).toBeTruthy();
    await svc.decrypt(await svc.encrypt('b'));
    const raw2 = await secureStore.getItemAsync('@coda_encryption_key');
    expect(raw2).toBe(raw);
  });

  it('base64 helpers round-trip arbitrary bytes without btoa/atob', () => {
    const { bytesToBase64, base64ToBytes } = getBase64();
    const inputs = [
      new Uint8Array(0),
      new Uint8Array([0]),
      new Uint8Array([1, 2, 3]),
      new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7]),
      new Uint8Array(64).map((_, i) => i),
      new Uint8Array(255).map((_, i) => (i * 7) % 256),
    ];
    for (const input of inputs) {
      expect(base64ToBytes(bytesToBase64(input))).toEqual(input);
    }
  });

  it('base64 helpers match standard base64 for known inputs', () => {
    const { bytesToBase64, base64ToBytes } = getBase64();
    const text = 'hello world';
    const bytes = new Uint8Array(text.length);
    for (let i = 0; i < text.length; i++) bytes[i] = text.charCodeAt(i);
    expect(bytesToBase64(bytes)).toBe('aGVsbG8gd29ybGQ=');
    const decoded = base64ToBytes('aGVsbG8gd29ybGQ=');
    expect(String.fromCharCode(...decoded)).toBe('hello world');
  });

  it('rejects invalid base64 input', () => {
    const { base64ToBytes } = getBase64();
    expect(() => base64ToBytes('not base64!!!')).toThrow();
  });
});
