import React, { useRef, useEffect, useMemo } from 'react';
import { View, StyleSheet, Text, ScrollView, Pressable } from 'react-native';

interface LyricsDisplayProps {
  lyrics: string;
  playbackPosition: number;
  accentColor: string;
  textColor: string;
  secondaryColor: string;
  onSeek?: (position: number) => void;
}

export interface LyricLine {
  time: number;
  text: string;
}

export function parseSyncedLyrics(raw: string): LyricLine[] {
  const lines: LyricLine[] = [];
  const tsRegex = /\[(\d{2}):(\d{2})(?:\.(\d{2,3}))?\]/g;
  const offsetRegex = /\[offset:\s*([+-]?\d+)\s*\]/;
  const enhancedTagRegex = /<(\d{1,2}):(\d{1,2})(?:[.:,](\d{1,3}))?>/g;
  const inputLines = raw.split('\n');
  let offset = 0;

  for (const inputLine of inputLines) {
    const offsetMatch = offsetRegex.exec(inputLine);
    if (offsetMatch && offset === 0) {
      offset = parseInt(offsetMatch[1], 10);
      continue;
    }

    const timestamps: number[] = [];
    let tsMatch: RegExpExecArray | null;
    tsRegex.lastIndex = 0;
    while ((tsMatch = tsRegex.exec(inputLine)) !== null) {
      const minutes = parseInt(tsMatch[1], 10);
      const seconds = parseInt(tsMatch[2], 10);
      let frac = 0;
      if (tsMatch[3]) {
        frac = tsMatch[3].length === 2
          ? parseInt(tsMatch[3], 10) * 10
          : parseInt(tsMatch[3], 10);
      }
      timestamps.push(minutes * 60000 + seconds * 1000 + frac);
    }

    const text = inputLine
      .replace(tsRegex, '')
      .replace(enhancedTagRegex, '')
      .trim();

    if (timestamps.length > 0 && text.length > 0) {
      for (const time of timestamps) {
        lines.push({ time: time - offset, text });
      }
    }
  }

  return lines.sort((a, b) => a.time - b.time);
}

export function findActiveLineIndex(lines: LyricLine[], position: number): number {
  if (lines.length === 0) return -1;
  let lo = 0;
  let hi = lines.length - 1;
  let result = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (lines[mid].time <= position) {
      result = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return result;
}

function isSynced(raw: string): boolean {
  return /\[\d{2}:\d{2}/.test(raw);
}

export function LyricsDisplay({
  lyrics,
  playbackPosition,
  accentColor,
  textColor,
  secondaryColor,
  onSeek,
}: LyricsDisplayProps) {
  const scrollRef = useRef<ScrollView>(null);
  const synced = useMemo(() => isSynced(lyrics), [lyrics]);
  const lines = useMemo(
    () => (synced ? parseSyncedLyrics(lyrics) : []),
    [lyrics, synced]
  );

  const activeIndex = useMemo(() => {
    if (!synced || lines.length === 0) return -1;
    return findActiveLineIndex(lines, playbackPosition);
  }, [synced, lines, playbackPosition]);

  useEffect(() => {
    if (activeIndex >= 0) {
      scrollRef.current?.scrollTo({ y: Math.max(0, (activeIndex - 2) * 36), animated: true });
    }
  }, [activeIndex]);

  if (synced) {
    return (
      <View style={styles.container}>
        <ScrollView
          ref={scrollRef}
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={{ height: 60 }} />
          {lines.map((line, i) => (
            <Pressable
              key={`${line.time}-${i}`}
              onPress={() => onSeek?.(line.time)}
              style={styles.linePressable}
            >
              <Text
                style={[
                  styles.line,
                  {
                    color: i === activeIndex ? accentColor : secondaryColor,
                    fontWeight: i === activeIndex ? '700' : '400',
                    fontSize: i === activeIndex ? 20 : 17,
                  },
                ]}
              >
                {line.text}
              </Text>
            </Pressable>
          ))}
          <View style={{ height: 120 }} />
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
        <View style={{ height: 60 }} />
        {lyrics.split('\n').map((line, i) => (
          <Text key={i} style={[styles.line, { color: textColor, fontSize: 18 }]}>
            {line.trim()}
          </Text>
        ))}
        <View style={{ height: 120 }} />
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
    lineHeight: 36,
  },
  linePressable: {
    paddingVertical: 2,
  },
});
