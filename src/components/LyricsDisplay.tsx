import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, StyleSheet, Text, ScrollView, Pressable } from 'react-native';

import { useReduceMotion } from '../hooks/useReduceMotion';
import {
  applyDurationScale,
  findActiveLineIndex,
  findActiveWordIndex,
  parseLyrics,
} from '../utils/lyrics';

export { findActiveLineIndex, parseSyncedLyrics } from '../utils/lyrics';

/** Line-only shape kept for callers that do not need word timings. */
export interface LyricLine {
  time: number;
  text: string;
}

interface LyricsDisplayProps {
  lyrics: string;
  playbackPosition: number;
  accentColor: string;
  textColor: string;
  secondaryColor: string;
  onSeek?: (position: number) => void;
  /** Word highlighting only advances while the track is playing. */
  isPlaying?: boolean;
  /** Length of the playing edit (ms), used to rescale lyrics from another edit. */
  trackDuration?: number;
  /** Length of the edit the lyrics were timed for (ms). */
  sourceDuration?: number;
  /** Manual sync nudge in milliseconds; positive delays the lyrics. */
  offsetMs?: number;
}

/** How often the interpolated position advances between player status updates. */
const TICK_MS = 100;

export function LyricsDisplay({
  lyrics,
  playbackPosition,
  accentColor,
  textColor,
  secondaryColor,
  onSeek,
  isPlaying = false,
  trackDuration,
  sourceDuration,
  offsetMs = 0,
}: LyricsDisplayProps) {
  const scrollRef = useRef<ScrollView>(null);
  const lineLayouts = useRef<{ y: number; height: number }[]>([]);
  const [viewportHeight, setViewportHeight] = useState(0);
  const reduceMotion = useReduceMotion();

  const lines = useMemo(
    () => applyDurationScale(parseLyrics(lyrics), trackDuration, sourceDuration),
    [lyrics, trackDuration, sourceDuration]
  );

  // Player status arrives about once a second; extrapolate between updates so
  // word highlighting moves smoothly instead of jumping once per second.
  const [position, setPosition] = useState(playbackPosition);
  const anchorRef = useRef({ position: playbackPosition, at: Date.now() });

  useEffect(() => {
    anchorRef.current = { position: playbackPosition, at: Date.now() };
    setPosition(playbackPosition);
  }, [playbackPosition]);

  useEffect(() => {
    if (!isPlaying) return;
    const id = setInterval(() => {
      const anchor = anchorRef.current;
      const next = anchor.position + (Date.now() - anchor.at);
      setPosition((previous) => {
        // Only re-render when the highlighted line or word actually changes.
        const previousLine = findActiveLineIndex(lines, previous);
        const nextLine = findActiveLineIndex(lines, next);
        if (previousLine !== nextLine) return next;
        const previousWord = findActiveWordIndex(lines[previousLine]?.words ?? [], previous);
        const nextWord = findActiveWordIndex(lines[nextLine]?.words ?? [], next);
        return previousWord === nextWord ? previous : next;
      });
    }, TICK_MS);
    return () => clearInterval(id);
  }, [isPlaying, lines]);

  useEffect(() => {
    lineLayouts.current = [];
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [lyrics]);

  const activeIndex = useMemo(
    () => findActiveLineIndex(lines, position - offsetMs),
    [lines, position, offsetMs]
  );

  useEffect(() => {
    if (activeIndex < 0 || viewportHeight <= 0) return;
    const layout = lineLayouts.current[activeIndex];
    if (!layout) return;
    scrollRef.current?.scrollTo({
      y: Math.max(0, layout.y - viewportHeight / 2 + layout.height / 2),
      animated: !reduceMotion,
    });
  }, [activeIndex, viewportHeight, reduceMotion]);

  if (lines.length > 0) {
    return (
      <View style={styles.container}>
        <ScrollView
          ref={scrollRef}
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          onLayout={(event) => setViewportHeight(event.nativeEvent.layout.height)}
        >
          <View style={{ height: 48 }} />
          {lines.map((line, index) => {
            const isActive = index === activeIndex;
            const activeWord = isActive
              ? findActiveWordIndex(line.words, position - offsetMs)
              : -1;
            return (
              <Pressable
                key={`${line.time}-${index}`}
                onPress={() => onSeek?.(line.time + offsetMs)}
                style={styles.linePressable}
                accessibilityRole="button"
                accessibilityLabel={line.text}
                accessibilityHint="Seek to this line"
                onLayout={(event) => {
                  lineLayouts.current[index] = {
                    y: event.nativeEvent.layout.y,
                    height: event.nativeEvent.layout.height,
                  };
                }}
              >
                <Text
                  style={[
                    styles.line,
                    {
                      color: isActive ? textColor : secondaryColor,
                      fontWeight: isActive ? '700' : '400',
                      fontSize: isActive ? 20 : 17,
                      lineHeight: isActive ? 28 : 24,
                    },
                  ]}
                >
                  {isActive && line.words.length > 0
                    ? line.words.map((word, wordIndex) => (
                        <Text
                          key={`${wordIndex}-${word.text}`}
                          style={
                            wordIndex <= activeWord
                              ? { color: accentColor }
                              : { color: secondaryColor, opacity: 0.55 }
                          }
                        >
                          {word.text}
                          {wordIndex < line.words.length - 1 ? ' ' : ''}
                        </Text>
                      ))
                    : line.text}
                </Text>
              </Pressable>
            );
          })}
          <View style={{ height: 160 }} />
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ height: 48 }} />
        {lyrics.split('\n').map((line, i) => (
          <Text key={i} style={[styles.line, { color: textColor, fontSize: 18, lineHeight: 24 }]}>
            {line.trim()}
          </Text>
        ))}
        <View style={{ height: 160 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
  },
  line: {
    textAlign: 'center',
  },
  linePressable: {
    paddingVertical: 2,
  },
});
