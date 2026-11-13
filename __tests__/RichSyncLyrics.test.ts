import { fetchRichSyncLyrics, richSyncToLrc } from '../src/services/RichSyncLyrics';
import { parseLyrics } from '../src/utils/lyrics';

const body = JSON.stringify([
  {
    ts: 12.5,
    te: 15,
    x: 'line one',
    l: [
      { c: 'line', o: 0 },
      { c: 'one', o: 0.5 },
    ],
  },
  { ts: 16, te: 18, x: 'plain line' },
]);

const mockFetch = jest.fn();
global.fetch = mockFetch as any;

const query = (durationMs?: number) => ({
  artist: 'Artist',
  title: 'Song',
  album: 'Album',
  durationMs,
});

const ok = (bodyValue: unknown) => ({
  ok: true,
  json: async () => ({ message: { header: { status_code: 200 }, body: bodyValue } }),
});

beforeEach(() => {
  process.env.EXPO_PUBLIC_MUSIXMATCH_API_KEY = 'test-key';
  mockFetch.mockReset();
});

afterEach(() => {
  delete process.env.EXPO_PUBLIC_MUSIXMATCH_API_KEY;
});

describe('richSyncToLrc', () => {
  it('converts line and word offsets to enhanced LRC', () => {
    expect(richSyncToLrc(body)).toBe(
      '[00:12.500] <00:12.500>line <00:13.000>one\n[00:16.000] plain line'
    );
  });

  it('parses back into word timings the display can use', () => {
    const lines = parseLyrics(richSyncToLrc(body)!);

    expect(lines[0].time).toBe(12500);
    expect(lines[0].words.map((word) => word.time)).toEqual([12500, 13000]);
    expect(lines[1].text).toBe('plain line');
  });

  it('returns null for malformed or empty payloads', () => {
    expect(richSyncToLrc('not json')).toBeNull();
    expect(richSyncToLrc('{}')).toBeNull();
    expect(richSyncToLrc('[]')).toBeNull();
  });

  it('skips entries without a timestamp or text', () => {
    const payload = JSON.stringify([
      { l: [{ c: 'no timestamp', o: 0 }] },
      { ts: 5 },
      { ts: 6, x: 'ok' },
    ]);
    expect(richSyncToLrc(payload)).toBe('[00:06.000] ok');
  });
});

describe('fetchRichSyncLyrics', () => {
  it('is a no-op without an API key', async () => {
    delete process.env.EXPO_PUBLIC_MUSIXMATCH_API_KEY;

    await expect(fetchRichSyncLyrics(query(180000))).resolves.toBeNull();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('matches a track and returns word-timed lyrics', async () => {
    mockFetch
      .mockResolvedValueOnce(
        ok({ track: { track_id: 42, track_length: 181, has_richsync: 1 } })
      )
      .mockResolvedValueOnce(ok({ richsync: { richsync_body: body } }));

    const result = await fetchRichSyncLyrics(query(180000));

    expect(result).toContain('<00:12.500>line');
    expect(mockFetch.mock.calls[0][0]).toContain('matcher.track.get');
    expect(mockFetch.mock.calls[0][0]).toContain('apikey=test-key');
    expect(mockFetch.mock.calls[0][0]).toContain('q_artist=Artist');
    expect(mockFetch.mock.calls[1][0]).toContain('track.richsync.get');
    expect(mockFetch.mock.calls[1][0]).toContain('track_id=42');
  });

  it('rejects a match whose length is far from the track', async () => {
    mockFetch.mockResolvedValueOnce(
      ok({ track: { track_id: 42, track_length: 240, has_richsync: 1 } })
    );

    await expect(fetchRichSyncLyrics(query(180000))).resolves.toBeNull();
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('returns null when the match has no richsync', async () => {
    mockFetch.mockResolvedValueOnce(ok({ track: { track_id: 42, has_richsync: 0 } }));

    await expect(fetchRichSyncLyrics(query(180000))).resolves.toBeNull();
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('returns null on provider errors', async () => {
    mockFetch.mockRejectedValueOnce(new Error('offline'));

    await expect(fetchRichSyncLyrics(query(180000))).resolves.toBeNull();
  });

  it('returns null for unknown artists', async () => {
    await expect(
      fetchRichSyncLyrics({ ...query(180000), artist: 'Unknown Artist' })
    ).resolves.toBeNull();
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
