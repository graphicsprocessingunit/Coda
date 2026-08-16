import * as SecureStore from 'expo-secure-store';

function getService() {
  const { CryptoService } = require('../src/services/CryptoService');
  return CryptoService as typeof import('../src/services/CryptoService').CryptoService;
}

describe('CryptoService', () => {
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
    const payload = await getService().encrypt('trust me');
    const [version, b64] = payload.split(':');
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    bytes[bytes.length - 1] ^= 0xff;
    const tampered = version + ':' + btoa(String.fromCharCode(...bytes));
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
});
