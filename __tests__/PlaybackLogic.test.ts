import {
  CROSSFADE_TRIGGER_LEAD_MS,
  SCROBBLE_MAX_SECONDS,
  canRestorePlayback,
  pickPlaybackUri,
  shouldScrobble,
  shouldStartCrossfade,
  scrobbleThresholdSeconds,
  shuffleArray,
} from '../src/services/PlaybackLogic';

describe('shuffleArray', () => {
  it('keeps every element exactly once', () => {
    const input = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const result = shuffleArray(input);
    expect(result).toHaveLength(input.length);
    expect([...result].sort((a, b) => a - b)).toEqual(input);
  });

  it('does not mutate the input array', () => {
    const input = ['a', 'b', 'c', 'd'];
    const copy = [...input];
    shuffleArray(input);
    expect(input).toEqual(copy);
  });

  it('returns a new array even for empty and single-element inputs', () => {
    const empty: number[] = [];
    const emptyResult = shuffleArray(empty);
    expect(emptyResult).toEqual([]);
    expect(emptyResult).not.toBe(empty);

    const one = ['only'];
    const oneResult = shuffleArray(one);
    expect(oneResult).toEqual(one);
    expect(oneResult).not.toBe(one);
  });
});

describe('shouldStartCrossfade', () => {
  const base = {
    enabled: true,
    durationSeconds: 4,
    repeatEnabled: false,
    active: false,
    started: false,
    remainingMs: 4000,
  };

  it('fires inside the crossfade window', () => {
    expect(shouldStartCrossfade(base)).toBe(true);
    expect(shouldStartCrossfade({ ...base, remainingMs: 10 })).toBe(true);
  });

  it('includes the trigger lead in the boundary', () => {
    expect(
      shouldStartCrossfade({ ...base, remainingMs: 4000 + CROSSFADE_TRIGGER_LEAD_MS })
    ).toBe(true);
    expect(
      shouldStartCrossfade({ ...base, remainingMs: 4000 + CROSSFADE_TRIGGER_LEAD_MS + 1 })
    ).toBe(false);
  });

  it('does nothing when the track has already ended', () => {
    expect(shouldStartCrossfade({ ...base, remainingMs: 0 })).toBe(false);
    expect(shouldStartCrossfade({ ...base, remainingMs: -1000 })).toBe(false);
  });

  it('requires crossfade to be enabled with a positive duration', () => {
    expect(shouldStartCrossfade({ ...base, enabled: false })).toBe(false);
    expect(shouldStartCrossfade({ ...base, durationSeconds: 0 })).toBe(false);
    expect(shouldStartCrossfade({ ...base, durationSeconds: -2 })).toBe(false);
  });

  it('never starts while repeating, active, or already started', () => {
    expect(shouldStartCrossfade({ ...base, repeatEnabled: true })).toBe(false);
    expect(shouldStartCrossfade({ ...base, active: true })).toBe(false);
    expect(shouldStartCrossfade({ ...base, started: true })).toBe(false);
  });

  it('rejects non-finite remaining time', () => {
    expect(shouldStartCrossfade({ ...base, remainingMs: NaN })).toBe(false);
    expect(shouldStartCrossfade({ ...base, remainingMs: Infinity })).toBe(false);
  });
});

describe('scrobbleThresholdSeconds', () => {
  it('is half the duration for short tracks', () => {
    expect(scrobbleThresholdSeconds(120)).toBe(60);
  });

  it('caps at the Last.fm minimum-play limit', () => {
    expect(scrobbleThresholdSeconds(600)).toBe(SCROBBLE_MAX_SECONDS);
    expect(scrobbleThresholdSeconds(SCROBBLE_MAX_SECONDS * 2)).toBe(SCROBBLE_MAX_SECONDS);
  });

  it('returns zero for missing or invalid durations', () => {
    expect(scrobbleThresholdSeconds(0)).toBe(0);
    expect(scrobbleThresholdSeconds(-30)).toBe(0);
    expect(scrobbleThresholdSeconds(NaN)).toBe(0);
  });
});

describe('pickPlaybackUri', () => {
  const cached = 'file:///Coda/Downloads/audio/1.mp3';

  it('prefers a cached file that still exists', () => {
    expect(pickPlaybackUri({ uri: 'https://server/stream/1', cachedUri: cached }, () => true)).toBe(
      cached
    );
  });

  it('falls back to the original when the cached file is gone', () => {
    expect(
      pickPlaybackUri({ uri: 'https://server/stream/1', cachedUri: cached }, () => false)
    ).toBe('https://server/stream/1');
  });

  it('uses the original when nothing is cached', () => {
    expect(pickPlaybackUri({ uri: cached }, () => false)).toBe(cached);
  });

  it('keeps a non-file cached uri without touching the filesystem', () => {
    const exists = jest.fn(() => false);
    expect(pickPlaybackUri({ uri: 'https://server/stream/1', cachedUri: 'https://cdn/1.mp3' }, exists)).toBe(
      'https://cdn/1.mp3'
    );
    expect(exists).not.toHaveBeenCalled();
  });
});

describe('canRestorePlayback', () => {
  const cached = 'file:///Coda/Downloads/audio/1.mp3';

  it('restores a downloaded Navidrome track', () => {
    expect(
      canRestorePlayback(
        { uri: 'https://server/stream/1', cachedUri: cached, source: 'navidrome' },
        () => true
      )
    ).toBe(true);
  });

  it('never restores a Navidrome track that is only streamable', () => {
    expect(canRestorePlayback({ uri: 'https://server/stream/1', source: 'navidrome' }, () => true)).toBe(
      false
    );
  });

  it('does not restore a Navidrome download that was deleted', () => {
    expect(
      canRestorePlayback(
        { uri: 'https://server/stream/1', cachedUri: cached, source: 'navidrome' },
        () => false
      )
    ).toBe(false);
  });

  it('restores a local file that still exists', () => {
    expect(canRestorePlayback({ uri: cached, source: 'local' }, () => true)).toBe(true);
  });

  it('skips a local file that was removed from the device', () => {
    expect(canRestorePlayback({ uri: cached, source: 'local' }, () => false)).toBe(false);
  });
});

describe('shouldScrobble', () => {
  it('waits until the threshold is reached', () => {
    expect(shouldScrobble(59, 120, false)).toBe(false);
    expect(shouldScrobble(60, 120, false)).toBe(true);
    expect(shouldScrobble(61, 120, false)).toBe(true);
  });

  it('caps long tracks at four minutes', () => {
    expect(shouldScrobble(239, 3600, false)).toBe(false);
    expect(shouldScrobble(240, 3600, false)).toBe(true);
  });

  it('submits only once per track', () => {
    expect(shouldScrobble(300, 120, true)).toBe(false);
  });

  it('does not submit for unknown or zero durations', () => {
    expect(shouldScrobble(300, 0, false)).toBe(false);
    expect(shouldScrobble(300, NaN, false)).toBe(false);
  });
});
