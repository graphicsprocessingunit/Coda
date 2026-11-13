import { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import type { AudioPlayer, AudioSample } from 'expo-audio';

import { loadLyricOffset, lyricOffsetKey, saveLyricOffset } from '../services/LyricsAlignment';
import {
  buildOnsetEnvelope,
  computeSampleEnergy,
  estimateLyricOffset,
  type OnsetSample,
} from '../services/LyricsOnset';

/** Keep sampling short: long enough for a stable median, short enough to be invisible. */
const MIN_CALIBRATION_MS = 12000;
const MAX_CALIBRATION_MS = 45000;
const MIN_TRACK_SECONDS = 10;

interface Params {
  enabled: boolean;
  isPlaying: boolean;
  getPlayer: () => AudioPlayer | null;
  artist: string;
  title: string;
  durationMs?: number;
  lineTimesMs: readonly number[];
}

/**
 * Learns a per-track lyric offset from real playback audio.
 *
 * iOS only: expo-audio's sampling requires RECORD_AUDIO on Android, and this
 * app deliberately does not request microphone access for a display-only
 * correction. If sampling is unsupported or the estimate is not confident, the
 * offset stays at zero and nothing is cached.
 */
export function useLyricsAlignment({
  enabled,
  isPlaying,
  getPlayer,
  artist,
  title,
  durationMs,
  lineTimesMs,
}: Params): number {
  const key = lyricOffsetKey({ artist, title, durationMs });
  const [offsetMs, setOffsetMs] = useState(0);
  const [hasCached, setHasCached] = useState(false);
  const attemptedRef = useRef<string | null>(null);

  useEffect(() => {
    let active = true;
    setOffsetMs(0);
    setHasCached(false);

    loadLyricOffset(key).then((value) => {
      if (!active || value === null) return;
      setOffsetMs(value);
      setHasCached(true);
    });

    return () => {
      active = false;
    };
  }, [key]);

  useEffect(() => {
    if (!enabled || !isPlaying || hasCached || Platform.OS !== 'ios') return;
    if (lineTimesMs.length < 8) return;
    if (attemptedRef.current === key) return;

    const player = getPlayer();
    if (!player || !player.isAudioSamplingSupported) return;

    let active = true;
    let timer: ReturnType<typeof setInterval> | null = null;
    let startedAt = Date.now();
    const samples: OnsetSample[] = [];

    const stopSampling = () => {
      try {
        player.removeListener('audioSampleUpdate', onSample);
      } catch {
        // The player may already have been replaced (crossfade/track change).
      }
      try {
        player.setAudioSamplingEnabled(false);
      } catch {
        // Nothing to disable if the native player is gone.
      }
      if (timer) clearInterval(timer);
      timer = null;
    };

    const finish = () => {
      if (!active) return;
      active = false;
      attemptedRef.current = key;
      stopSampling();

      const onsets = buildOnsetEnvelope(samples);
      const estimate = estimateLyricOffset(lineTimesMs, onsets);
      if (!estimate) return;

      setOffsetMs(estimate.offsetMs);
      setHasCached(true);
      void saveLyricOffset(key, estimate);
    };

    const onSample = (sample: AudioSample) => {
      if (!active || !Number.isFinite(sample.timestamp)) return;
      const channelEnergy = sample.channels.length
        ? sample.channels.reduce((sum, channel) => sum + computeSampleEnergy(channel.frames), 0) /
          sample.channels.length
        : 0;
      samples.push({ time: sample.timestamp, energy: channelEnergy });

      const spannedMs = samples.length > 1 ? (sample.timestamp - samples[0].time) * 1000 : 0;
      if (
        Date.now() - startedAt >= MIN_CALIBRATION_MS &&
        spannedMs >= MIN_TRACK_SECONDS * 1000 * 0.5
      ) {
        finish();
      } else if (Date.now() - startedAt >= MAX_CALIBRATION_MS) {
        finish();
      }
    };

    try {
      player.setAudioSamplingEnabled(true);
      player.addListener('audioSampleUpdate', onSample);
      startedAt = Date.now();
      timer = setInterval(() => {
        if (Date.now() - startedAt >= MAX_CALIBRATION_MS) finish();
      }, 1000);
    } catch {
      attemptedRef.current = key;
      stopSampling();
    }

    return () => {
      active = false;
      stopSampling();
    };
  }, [enabled, isPlaying, hasCached, key, lineTimesMs, getPlayer]);

  return offsetMs;
}
