import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  IPOD_FINISHES,
  IPOD_SCREEN,
  DEFAULT_FINISH_ID,
  finishFor,
  nearestFinish,
} from '../components/ipod/ipodTheme';

export type Theme = 'dark' | 'light' | 'midnight' | 'ocean';
export type AppLayout = 'standard' | 'ipod';

interface ThemeColors {
  background: string;
  card: string;
  text: string;
  textSecondary: string;
  accent: string;
  border: string;
  tabBar: string;
  danger: string;
  success: string;
}

export type { ThemeColors };

const themes: Record<Theme, ThemeColors> = {
  dark: {
    background: '#000000',
    card: '#1C1C1E',
    text: '#FFFFFF',
    textSecondary: '#8E8E93',
    accent: '#007AFF',
    border: '#1C1C1E',
    tabBar: '#000000',
    danger: '#FF3B30',
    success: '#34C759',
  },
  light: {
    background: '#F2F2F7',
    card: '#FFFFFF',
    text: '#000000',
    textSecondary: '#8E8E93',
    accent: '#007AFF',
    border: '#C6C6C8',
    tabBar: '#F2F2F7',
    danger: '#FF3B30',
    success: '#34C759',
  },
  midnight: {
    background: '#0A0E27',
    card: '#1A1F3A',
    text: '#E8E8F0',
    textSecondary: '#8B8BA7',
    accent: '#6C5CE7',
    border: '#1A1F3A',
    tabBar: '#0A0E27',
    danger: '#FF453A',
    success: '#32D74B',
  },
  ocean: {
    background: '#0F172A',
    card: '#1E293B',
    text: '#F1F5F9',
    textSecondary: '#94A3B8',
    accent: '#06B6D4',
    border: '#1E293B',
    tabBar: '#0F172A',
    danger: '#FF453A',
    success: '#32D74B',
  },
};

export interface IpodPalette {
  finishId: string;
  wheelColor: string;
  wheelLabel: string;
  centerFace: string;
  faceplate: string;
  faceplateEdge: string;
  screenBg: string;
  screenText: string;
  highlight: string;
  highlightBottom: string;
}

function withAlpha(hex: string, alpha: number): string {
  const m = /^#?([0-9a-fA-F]{6})$/.exec(hex);
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function shade(hex: string, amount: number): string {
  const m = /^#?([0-9a-fA-F]{6})$/.exec(hex);
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const clamp = (v: number) => Math.max(0, Math.min(255, v));
  const r = clamp(((n >> 16) & 255) + amount);
  const g = clamp(((n >> 8) & 255) + amount);
  const b = clamp((n & 255) + amount);
  const to = (v: number) => v.toString(16).padStart(2, '0');
  return `#${to(r)}${to(g)}${to(b)}`;
}

function ipodColors(p: IpodPalette): ThemeColors {
  return {
    background: p.screenBg,
    card: shade(p.screenBg, p.screenBg === '#000000' ? 14 : -4),
    text: p.screenText,
    textSecondary: withAlpha(p.screenText, 0.62),
    accent: p.highlight,
    border: withAlpha(p.screenText, 0.2),
    tabBar: p.screenBg,
    danger: '#FF3B30',
    success: '#34C759',
  };
}

function ipodFromFinish(finishId: string): IpodPalette {
  const f = finishFor(finishId);
  return {
    finishId: f.id,
    wheelColor: f.wheelFace,
    wheelLabel: f.wheelLabel,
    centerFace: f.centerFace,
    faceplate: f.faceplate,
    faceplateEdge: f.faceplateEdge,
    screenBg: IPOD_SCREEN.bg,
    screenText: IPOD_SCREEN.text,
    highlight: IPOD_SCREEN.highlightTop,
    highlightBottom: IPOD_SCREEN.highlightBottom,
  };
}

interface ThemeContextType {
  theme: Theme;
  colors: ThemeColors;
  setTheme: (theme: Theme) => void;
  isDark: boolean;
  layout: AppLayout;
  setLayout: (layout: AppLayout) => void;
  ipod: IpodPalette;
  setIpodFinish: (finishId: string) => void;
  resetIpodFinish: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const THEME_KEY = '@coda_theme';
const LAYOUT_KEY = '@coda_layout';
const IPOD_KEY = '@coda_ipod_palette';
const FINISH_KEY = '@coda_ipod_finish';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('dark');
  const [layout, setLayoutState] = useState<AppLayout>('standard');
  const [finish, setFinishState] = useState<string>(DEFAULT_FINISH_ID);

  useEffect(() => {
    loadAppearance();
  }, []);

  const loadAppearance = async () => {
    try {
      const [savedTheme, savedLayout, savedFinish, legacyPalette] = await Promise.all([
        AsyncStorage.getItem(THEME_KEY),
        AsyncStorage.getItem(LAYOUT_KEY),
        AsyncStorage.getItem(FINISH_KEY),
        AsyncStorage.getItem(IPOD_KEY),
      ]);
      if (savedTheme && themes[savedTheme as Theme]) {
        setThemeState(savedTheme as Theme);
      }
      if (savedLayout === 'standard' || savedLayout === 'ipod') {
        setLayoutState(savedLayout);
      }
      const hasFinish = IPOD_FINISHES.some((f) => f.id === savedFinish);
      if (hasFinish) {
        setFinishState(savedFinish as string);
      } else if (legacyPalette) {
        try {
          const parsed = JSON.parse(legacyPalette) as Partial<IpodPalette>;
          setFinishState(nearestFinish(String(parsed.wheelColor ?? '')));
        } catch {
          setFinishState(DEFAULT_FINISH_ID);
        }
      }
    } catch (error) {
      console.error('Error loading appearance:', error);
    }
  };

  const setTheme = async (newTheme: Theme) => {
    try {
      await AsyncStorage.setItem(THEME_KEY, newTheme);
      setThemeState(newTheme);
    } catch (error) {
      console.error('Error saving theme:', error);
    }
  };

  const setLayout = async (newLayout: AppLayout) => {
    try {
      await AsyncStorage.setItem(LAYOUT_KEY, newLayout);
      setLayoutState(newLayout);
    } catch (error) {
      console.error('Error saving layout:', error);
    }
  };

  const setIpodFinish = async (finishId: string) => {
    try {
      await AsyncStorage.setItem(FINISH_KEY, finishId);
      setFinishState(finishId);
    } catch (error) {
      console.error('Error saving iPod finish:', error);
    }
  };

  const resetIpodFinish = async () => {
    try {
      await AsyncStorage.removeItem(FINISH_KEY);
      await AsyncStorage.removeItem(IPOD_KEY);
      setFinishState(DEFAULT_FINISH_ID);
    } catch (error) {
      console.error('Error resetting iPod finish:', error);
    }
  };

  const isDark = theme !== 'light';

  const ipod = useMemo(() => ipodFromFinish(finish), [finish]);

  const colors: ThemeColors = useMemo(
    () => (layout === 'ipod' ? ipodColors(ipod) : themes[theme]),
    [layout, ipod, theme]
  );

  const value: ThemeContextType = useMemo(
    () => ({ theme, colors, setTheme, isDark, layout, setLayout, ipod, setIpodFinish, resetIpodFinish }),
    [theme, colors, isDark, layout, ipod]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}