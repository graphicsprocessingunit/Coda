import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { SharedValue, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { useReduceMotion } from '../hooks/useReduceMotion';

const SPRING = { damping: 22, stiffness: 220, mass: 0.7 };
const EXPANDED = 1;
const COLLAPSED = 0;

interface NowPlayingContextValue {
  progress: SharedValue<number>;
  isExpanded: boolean;
  setExpanded: (value: boolean) => void;
  open: () => void;
  close: () => void;
  lastTabRef: React.MutableRefObject<string>;
}

const NowPlayingContext = createContext<NowPlayingContextValue | undefined>(undefined);

export function NowPlayingProvider({ children }: { children: React.ReactNode }) {
  const progress = useSharedValue(COLLAPSED);
  const [isExpanded, setIsExpanded] = useState(false);
  const lastTabRef = useRef('Library');
  const reduceMotion = useReduceMotion();

  const animateTo = useCallback(
    (to: number) => {
      progress.value = reduceMotion
        ? withTiming(to, { duration: 0 })
        : withSpring(to, SPRING);
    },
    [progress, reduceMotion]
  );

  const open = useCallback(() => {
    animateTo(EXPANDED);
    setIsExpanded(true);
  }, [animateTo]);

  const close = useCallback(() => {
    animateTo(COLLAPSED);
    setIsExpanded(false);
  }, [animateTo]);

  const value = useMemo(
    () => ({ progress, isExpanded, setExpanded: setIsExpanded, open, close, lastTabRef }),
    [progress, isExpanded, open, close]
  );

  return <NowPlayingContext.Provider value={value}>{children}</NowPlayingContext.Provider>;
}

export function useNowPlaying() {
  const context = useContext(NowPlayingContext);
  if (context === undefined) {
    throw new Error('useNowPlaying must be used within a NowPlayingProvider');
  }
  return context;
}
