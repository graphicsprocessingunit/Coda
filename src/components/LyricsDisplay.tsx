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

interface LyricLine {
  time: number;
  text: string;
}

function parseSyncedLyrics(raw: string): LyricLine[] {
  const lines: LyricLine[] = [];
  const tsRegex = /\[(\d{2}):(\d{2})(?:\.(\d{2,3}))?\]/g;
  const inputLines = raw.split('\n');

  for (const inputLine of inputLines) {
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

    const text = inputLine.replace(tsRegex, '').trim();

    if (timestamps.length > 0 && text.length > 0) {
      for (const time of timestamps) {
        lines.push({ time, text });
      }
    }
  }
  return lines;
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
    const delay = 300;
    let idx = -1;
    for (let i = 0; i < lines.length; i++) {
      if (playbackPosition >= lines[i].time + delay) idx = i;
      else break;
    }
    return idx;
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
