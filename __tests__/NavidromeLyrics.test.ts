import {
  chooseStructuredLyrics,
  structuredLyricsToLrc,
} from '../src/services/NavidromeLyrics';
import { NavidromeService, type NavidromeCredentials } from '../src/services/NavidromeService';

const creds: NavidromeCredentials = {
  url: 'http://navidrome.example.com',
  username: 'testuser',
  token: 'abc123',
  salt: 'deadbeef',
};

afterEach(() => {
  jest.restoreAllMocks();
});

describe('structuredLyricsToLrc', () => {
  it('formats timestamps as LRC', () => {
    expect(
      structuredLyricsToLrc([
        { start: 1000, value: 'one' },
        { start: 62500, value: 'two' },
        { start: 900, value: 'short' },
      ])
    ).toBe('[00:01.000]one\n[01:02.500]two\n[00:00.900]short');
  });
});

describe('chooseStructuredLyrics', () => {
  it('prefers a fully timed entry over a plain one', () => {
    const chosen = chooseStructuredLyrics([
      { synced: false, line: [{ value: 'plain' }] },
      { synced: true, line: [{ start: 0, value: 'timed' }, { start: 1200, value: 'line' }] },
    ]);

    expect(chosen).toEqual({ lyrics: '[00:00.000]timed\n[00:01.200]line', synced: true });
  });

  it('treats an entry with starts as timed even without a synced flag', () => {
    const chosen = chooseStructuredLyrics([
      { line: [{ start: 500, value: 'line' }] },
    ]);

    expect(chosen).toEqual({ lyrics: '[00:00.500]line', synced: true });
  });

  it('falls back to plain text when nothing is timed', () => {
    const chosen = chooseStructuredLyrics([
      { synced: false, line: [{ value: 'first' }, { value: 'second' }] },
    ]);

    expect(chosen).toEqual({ lyrics: 'first\nsecond', synced: false });
  });

  it('ignores empty lines and empty payloads', () => {
    expect(chooseStructuredLyrics([])).toBeNull();
    expect(chooseStructuredLyrics(undefined)).toBeNull();
    expect(chooseStructuredLyrics([{ line: [{ value: '   ' }] }])).toBeNull();
  });
});

describe('NavidromeService.getLyricsBySongId', () => {
  it('converts timed structured lyrics from the server', async () => {
    jest.spyOn(NavidromeService, 'loadCredentials').mockResolvedValue(creds);
    const apiCall = jest.spyOn(NavidromeService, 'apiCall').mockResolvedValue({
      lyricsList: {
        structuredLyrics: [
          {
            synced: true,
            line: [
              { start: 1000, value: 'one' },
              { start: 2500, value: 'two' },
            ],
          },
        ],
      },
    } as never);

    await expect(NavidromeService.getLyricsBySongId('song-1')).resolves.toEqual({
      lyrics: '[00:01.000]one\n[00:02.500]two',
      synced: true,
    });
    expect(apiCall).toHaveBeenCalledWith(creds, 'getLyricsBySongId', { id: 'song-1' });
  });

  it('returns null when there are no credentials', async () => {
    jest.spyOn(NavidromeService, 'loadCredentials').mockResolvedValue(null);

    await expect(NavidromeService.getLyricsBySongId('song-1')).resolves.toBeNull();
  });

  it('returns null when the server does not support the endpoint', async () => {
    jest.spyOn(NavidromeService, 'loadCredentials').mockResolvedValue(creds);
    jest.spyOn(NavidromeService, 'apiCall').mockRejectedValue(new Error('404'));

    await expect(NavidromeService.getLyricsBySongId('song-1')).resolves.toBeNull();
  });

  it('returns null when the song has no lyrics on the server', async () => {
    jest.spyOn(NavidromeService, 'loadCredentials').mockResolvedValue(creds);
    jest.spyOn(NavidromeService, 'apiCall').mockResolvedValue({} as never);

    await expect(NavidromeService.getLyricsBySongId('song-1')).resolves.toBeNull();
  });
});
