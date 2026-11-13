import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Modal, ScrollView } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
  clamp,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useTheme } from '../context/ThemeContext';
import { useAudio, useIsPlaying, usePlaybackPosition, useSleepTimer } from '../context/AudioContext';
import { useNowPlaying } from '../context/NowPlayingContext';
import { useReduceMotion } from '../hooks/useReduceMotion';
import { useArtworkAccent } from '../hooks/useArtworkAccent';
import { useAnimatedColor } from '../hooks/useAnimatedColor';
import { useResponsiveLayout } from '../hooks/useResponsiveLayout';
import { Player } from './Player';
import { Queue } from './Queue';
import { Equalizer } from './Equalizer';
import { AudioEffectsSection } from './AudioEffects';
import { SleepTimerSection } from './SleepTimer';
import { TrackInfo } from './TrackInfo';

const SPRING = { damping: 22, stiffness: 220, mass: 0.7 };
const VELOCITY_THRESHOLD = 400;
const TAB_BAR_HEIGHT = 49;

function MiniProgress({ accentColor }: { accentColor: string }) {
  const { playbackPosition, duration } = usePlaybackPosition();
  const fraction = duration > 0 ? Math.min(playbackPosition / duration, 1) : 0;
  return (
    <View style={styles.miniProgressTrack}>
      <View
        style={[
          styles.miniProgressFill,
          { width: `${fraction * 100}%`, backgroundColor: accentColor },
        ]}
      />
    </View>
  );
}

function TrackInfoModal({ track, onClose }: { track: any; onClose: () => void }) {
  const { duration } = usePlaybackPosition();
  const { colors } = useTheme();
  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { backgroundColor: colors.background }]}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Song Info</Text>
            <Pressable onPress={onClose} hitSlop={10}>
              <Ionicons name="close" size={28} color={colors.textSecondary} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
            <TrackInfo track={track} duration={duration} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

export function NowPlayingSheet() {
  const {
    currentTrack,
    play,
    pause,
    skipNext,
    skipPrevious,
    seekTo,
    shuffleEnabled,
    repeatEnabled,
    toggleShuffle,
    toggleRepeat,
    toggleFavorite,
  } = useAudio();
  const { isPlaying } = useIsPlaying();
  const { sleepTimerRemaining } = useSleepTimer();
  const { colors, isDark } = useTheme();
  const { progress, isExpanded, setExpanded, open } = useNowPlaying();
  const reduceMotion = useReduceMotion();
  const insets = useSafeAreaInsets();
  const { isTablet } = useResponsiveLayout();

  const accent = useArtworkAccent(currentTrack?.artwork, colors.accent, colors.background, isDark);
  const animatedAccent = useAnimatedColor(accent, reduceMotion ? 0 : 450);

  const [containerHeight, setContainerHeight] = useState(0);
  const containerHeightSv = useSharedValue(0);
  const reduceMotionSv = useSharedValue(reduceMotion);
  const startY = useSharedValue(0);
  const target = useSharedValue(0);

  useEffect(() => {
    containerHeightSv.value = containerHeight;
  }, [containerHeight, containerHeightSv]);

  useEffect(() => {
    reduceMotionSv.value = reduceMotion;
  }, [reduceMotion, reduceMotionSv]);

  const [showMore, setShowMore] = useState(false);
  const [showEffects, setShowEffects] = useState(false);
  const [showQueue, setShowQueue] = useState(false);
  const [showTrackInfo, setShowTrackInfo] = useState(false);

  const tabBarOffset = isTablet ? 0 : TAB_BAR_HEIGHT + insets.bottom;

  const makePan = (activation: [number, number]) =>
    Gesture.Pan()
      .activeOffsetY(activation)
      .onBegin(() => {
        startY.value = progress.value;
      })
      .onUpdate((event) => {
        const height = containerHeightSv.value;
        if (height <= 0) return;
        progress.value = clamp(startY.value - event.translationY / height, 0, 1);
      })
      .onEnd((event) => {
        target.value =
          event.velocityY < -VELOCITY_THRESHOLD
            ? 1
            : event.velocityY > VELOCITY_THRESHOLD
              ? 0
              : progress.value > 0.5
                ? 1
                : 0;
      })
      .onFinalize(() => {
        progress.value = reduceMotionSv.value
          ? withTiming(target.value, { duration: 0 })
          : withSpring(target.value, SPRING);
        runOnJS(setExpanded)(target.value === 1);
      });

  const expandGesture = makePan([-12, 100000]);
  const collapseGesture = makePan([-100000, 12]);

  const expandedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: (1 - progress.value) * containerHeightSv.value }],
  }));

  const miniStyle = useAnimatedStyle(() => ({
    opacity: 1 - progress.value,
    transform: [{ translateY: progress.value * 24 }],
  }));

  const scrimStyle = useAnimatedStyle(() => ({
    opacity: progress.value * 0.7,
  }));

  const tintStyle = useAnimatedStyle(() => ({
    backgroundColor: animatedAccent.value,
  }));

  return (
    <View
      style={StyleSheet.absoluteFill}
      pointerEvents="box-none"
      onLayout={(event) => setContainerHeight(event.nativeEvent.layout.height)}
    >
      <Animated.View style={[StyleSheet.absoluteFill, styles.scrim, scrimStyle]} pointerEvents="none" />

      <Animated.View
        style={[styles.expandedLayer, expandedStyle]}
        pointerEvents={isExpanded ? 'auto' : 'none'}
      >
        <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.background }]} />
        {currentTrack?.artwork ? (
          <Image
            source={{ uri: currentTrack.artwork }}
            style={[StyleSheet.absoluteFill, { opacity: 0.35 }]}
            contentFit="cover"
            blurRadius={30}
            cachePolicy="memory-disk"
          />
        ) : null}
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: 0.14 }, tintStyle]} />

        <GestureDetector gesture={collapseGesture}>
          <View style={[styles.grabberArea, { paddingTop: insets.top + 8 }]}>
            <View style={[styles.grabber, { backgroundColor: colors.textSecondary }]} />
          </View>
        </GestureDetector>

        <Player
          currentTrack={currentTrack}
          isPlaying={isPlaying}
          onPlay={play}
          onPause={pause}
          onSkipNext={skipNext}
          onSkipPrevious={skipPrevious}
          onSeek={seekTo}
          shuffleEnabled={shuffleEnabled}
          repeatEnabled={repeatEnabled}
          onToggleShuffle={toggleShuffle}
          onToggleRepeat={toggleRepeat}
          onMorePress={() => setShowMore(true)}
          onToggleFavorite={() => currentTrack && toggleFavorite(currentTrack.uri)}
          isFavorite={currentTrack?.isFavorite}
          sleepTimerRemaining={sleepTimerRemaining}
          accentColor={accent}
        />
      </Animated.View>

      {currentTrack && (
        <Animated.View
          style={[styles.miniWrap, { bottom: tabBarOffset }, miniStyle]}
          pointerEvents={isExpanded ? 'none' : 'box-none'}
        >
          <GestureDetector gesture={expandGesture}>
            <Pressable
              onPress={open}
              style={[styles.miniBar, { backgroundColor: colors.surface, borderTopColor: colors.border }]}
            >
              <MiniProgress accentColor={accent} />
              <View style={styles.miniContent}>
                {currentTrack.artwork ? (
                  <Image
                    source={{ uri: currentTrack.artwork }}
                    style={styles.miniArtwork}
                    contentFit="cover"
                    cachePolicy="memory-disk"
                    transition={reduceMotion ? 0 : 200}
                  />
                ) : (
                  <View style={[styles.miniArtwork, styles.miniArtworkPlaceholder, { backgroundColor: colors.border }]}>
                    <Ionicons name="musical-note" size={18} color={colors.textSecondary} />
                  </View>
                )}
                <View style={styles.miniInfo}>
                  <Text style={[styles.miniTitle, { color: colors.text }]} numberOfLines={1}>
                    {currentTrack.title}
                  </Text>
                  <Text style={[styles.miniArtist, { color: colors.textSecondary }]} numberOfLines={1}>
                    {currentTrack.artist}
                  </Text>
                </View>
                <Pressable style={styles.miniControl} onPress={skipPrevious} hitSlop={10}>
                  <Ionicons name="play-skip-back" size={22} color={colors.textSecondary} />
                </Pressable>
                <Pressable
                  style={styles.miniControl}
                  onPress={() => (isPlaying ? pause() : play())}
                  hitSlop={10}
                >
                  <Ionicons name={isPlaying ? 'pause' : 'play'} size={28} color={accent} />
                </Pressable>
                <Pressable style={styles.miniControl} onPress={skipNext} hitSlop={10}>
                  <Ionicons name="play-skip-forward" size={22} color={colors.textSecondary} />
                </Pressable>
              </View>
            </Pressable>
          </GestureDetector>
        </Animated.View>
      )}

      <Modal visible={showMore} animationType="slide" transparent onRequestClose={() => setShowMore(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.background }]}>
            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>More</Text>
              <Pressable onPress={() => setShowMore(false)} hitSlop={10}>
                <Ionicons name="close" size={28} color={colors.textSecondary} />
              </Pressable>
            </View>
            <View style={{ padding: 12 }}>
              <Pressable
                style={[styles.moreRow, { borderBottomColor: colors.border }]}
                onPress={() => {
                  setShowMore(false);
                  setTimeout(() => setShowQueue(true), 200);
                }}
              >
                <Ionicons name="list" size={24} color={colors.textSecondary} />
                <Text style={[styles.moreRowText, { color: colors.text }]}>Queue</Text>
                <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
              </Pressable>
              <Pressable
                style={[styles.moreRow, { borderBottomColor: colors.border }]}
                onPress={() => {
                  setShowMore(false);
                  setTimeout(() => setShowEffects(true), 200);
                }}
              >
                <Ionicons name="options" size={24} color={colors.textSecondary} />
                <Text style={[styles.moreRowText, { color: colors.text }]}>Audio Settings</Text>
                <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
              </Pressable>
              <Pressable
                style={styles.moreRow}
                onPress={() => {
                  setShowMore(false);
                  setTimeout(() => setShowTrackInfo(true), 200);
                }}
              >
                <Ionicons name="information-circle" size={24} color={colors.textSecondary} />
                <Text style={[styles.moreRowText, { color: colors.text }]}>Song Info</Text>
                <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={showEffects} animationType="slide" transparent onRequestClose={() => setShowEffects(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.background }]}>
            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Audio Settings</Text>
              <Pressable onPress={() => setShowEffects(false)} hitSlop={10}>
                <Ionicons name="close" size={28} color={colors.textSecondary} />
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
              <Equalizer />
              <AudioEffectsSection />
              <SleepTimerSection />
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={showQueue} animationType="slide" transparent onRequestClose={() => setShowQueue(false)}>
        <View style={styles.queueOverlay}>
          <View style={[styles.queueContent, { backgroundColor: colors.background }]}>
            <Queue onClose={() => setShowQueue(false)} />
          </View>
        </View>
      </Modal>

      {showTrackInfo && currentTrack && (
        <TrackInfoModal track={currentTrack} onClose={() => setShowTrackInfo(false)} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  scrim: {
    backgroundColor: '#000000',
  },
  expandedLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  grabberArea: {
    alignItems: 'center',
    paddingBottom: 10,
  },
  grabber: {
    width: 40,
    height: 5,
    borderRadius: 3,
    opacity: 0.6,
  },
  miniWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
  },
  miniBar: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  miniProgressTrack: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: 'transparent',
  },
  miniProgressFill: {
    height: 2,
    borderTopRightRadius: 2,
    borderBottomRightRadius: 2,
  },
  miniContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  miniArtwork: {
    width: 44,
    height: 44,
    borderRadius: 6,
    marginRight: 12,
  },
  miniArtworkPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniInfo: {
    flex: 1,
    marginRight: 8,
  },
  miniTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  miniArtist: {
    fontSize: 13,
    marginTop: 2,
  },
  miniControl: {
    padding: 6,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '700',
  },
  moreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  moreRowText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
  },
  queueOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  queueContent: {
    flex: 1,
    marginTop: 60,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
});
