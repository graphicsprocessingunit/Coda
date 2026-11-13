import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, StyleSheet, Text, ScrollView, Pressable } from 'react-native';

import { useReduceMotion } from '../hooks/useReduceMotion';
import { useSyncedLyricsEnabled } from '../hooks/useSyncedLyricsEnabled';
import {
  findActiveLineIndex,
  findActiveWordIndex,
  parseLyrics,
  shiftLyricLines,
  type LyricLine as TimedLyricLine,
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
  /** Per-track timing correction learned from playback onsets, in milliseconds. */
  offsetMs?: number;
}

/** How often the interpolated position advances between player status updates. */
const TICK_MS = 100;

interface LyricRowProps {
  line: TimedLyricLine;
  index: number;
  isActive: boolean;
  activeWord: number;
  accentColor: string;
  textColor: string;
  secondaryColor: string;
  onSeek: (line: TimedLyricLine) => void;
  onLayout: (index: number, y: number, height: number) => void;
}

/**
 * Rows are memoised: during playback only the active line changes, so the
 * other lines must not be rebuilt several times a second.
 */
const LyricRow = React.memo(function LyricRow({
  line,
  index,
  isActive,
  activeWord,
  accentColor,
  textColor,
  secondaryColor,
  onSeek,
  onLayout,
}: LyricRowProps) {
  return (
    <Pressable
      onPress={() => onSeek(line)}
      style={styles.linePressable}
      accessibilityRole="button"
      accessibilityLabel={line.text}
      accessibilityHint="Seek to this line"
      onLayout={(event) =>
        onLayout(index, event.nativeEvent.layout.y, event.nativeEvent.layout.height)
      }
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
});

export function LyricsDisplay({
  lyrics,
  playbackPosition,
  accentColor,
  textColor,
  secondaryColor,
  onSeek,
  isPlaying = false,
  offsetMs = 0,
}: LyricsDisplayProps) {
  const scrollRef = useRef<ScrollView>(null);
  const lineLayouts = useRef<{ y: number; height: number }[]>([]);
  const [viewportHeight, setViewportHeight] = useState(0);
  const reduceMotion = useReduceMotion();
  const syncedLyricsEnabled = useSyncedLyricsEnabled();

  const lines = useMemo(() => {
    const parsed = parseLyrics(lyrics);
    return offsetMs ? shiftLyricLines(parsed, offsetMs) : parsed;
  }, [lyrics, offsetMs]);

  // With sync turned off, timed lyrics are shown as plain, untimed text.
  const plainLines = useMemo(() => {
    if (lines.length > 0) {
      return lines.map((line) => line.text).filter((text) => text.length > 0);
    }
    return lyrics
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
  }, [lines, lyrics]);

  // Player status arrives about once a second; extrapolate between updates so
  // word highlighting moves smoothly instead of jumping once per second.
  const [position, setPosition] = useState(playbackPosition);
  const anchorRef = useRef({ position: playbackPosition, at: Date.now() });

  useEffect(() => {
    anchorRef.current = { position: playbackPosition, at: Date.now() };
    setPosition(playbackPosition);
  }, [playbackPosition]);

  useEffect(() => {
    if (!isPlaying || !syncedLyricsEnabled) return;
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
  }, [isPlaying, lines, syncedLyricsEnabled]);

  useEffect(() => {
    lineLayouts.current = [];
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [lyrics, offsetMs]);

  const activeIndex = useMemo(() => findActiveLineIndex(lines, position), [lines, position]);

  const activeWord = useMemo(
    () =>
      activeIndex >= 0 ? findActiveWordIndex(lines[activeIndex]?.words ?? [], position) : -1,
    [activeIndex, lines, position]
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

  const handleSeek = useCallback(
    (line: TimedLyricLine) => {
      onSeek?.(line.time);
    },
    [onSeek]
  );

  const handleLineLayout = useCallback((index: number, y: number, height: number) => {
    lineLayouts.current[index] = { y, height };
  }, []);

  if (syncedLyricsEnabled && lines.length > 0) {
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
          {lines.map((line, index) => (
            <LyricRow
              key={`${line.time}-${index}`}
              line={line}
              index={index}
              isActive={index === activeIndex}
              activeWord={index === activeIndex ? activeWord : -1}
              accentColor={accentColor}
              textColor={textColor}
              secondaryColor={secondaryColor}
              onSeek={handleSeek}
              onLayout={handleLineLayout}
            />
          ))}
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
        {plainLines.map((line, i) => (
          <Text key={i} style={[styles.line, { color: textColor, fontSize: 18, lineHeight: 24 }]}>
            {line}
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
