import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

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
  wheelColor: string;
  screenBg: string;
  screenText: string;
  highlight: string;
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

function defaultIpodPalette(themeColors: ThemeColors): IpodPalette {
  return {
    wheelColor: themeColors.text === '#FFFFFF' ? '#1C1C1E' : '#F0F0F0',
    screenBg: themeColors.background,
    screenText: themeColors.text,
    highlight: themeColors.accent,
  };
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

export function effectiveIpodPalette(theme: Theme, stored: IpodPalette | null): IpodPalette {
  return stored ?? defaultIpodPalette(themes[theme]);
}

function isHex(value: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(value);
}

interface PalettePatch {
  wheelColor?: string;
  screenBg?: string;
  screenText?: string;
  highlight?: string;
}

interface ThemeContextType {
  theme: Theme;
  colors: ThemeColors;
  setTheme: (theme: Theme) => void;
  isDark: boolean;
  layout: AppLayout;
  setLayout: (layout: AppLayout) => void;
  ipod: IpodPalette;
  setIpodPalette: (patch: PalettePatch) => void;
  resetIpodPalette: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const THEME_KEY = '@coda_theme';
const LAYOUT_KEY = '@coda_layout';
const IPOD_KEY = '@coda_ipod_palette';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('dark');
  const [layout, setLayoutState] = useState<AppLayout>('standard');
  const [ipodStored, setIpodStored] = useState<IpodPalette | null>(null);

  useEffect(() => {
    loadAppearance();
  }, []);

  const loadAppearance = async () => {
    try {
      const [savedTheme, savedLayout, savedIpod] = await Promise.all([
        AsyncStorage.getItem(THEME_KEY),
        AsyncStorage.getItem(LAYOUT_KEY),
        AsyncStorage.getItem(IPOD_KEY),
      ]);
      if (savedTheme && themes[savedTheme as Theme]) {
        setThemeState(savedTheme as Theme);
      }
      if (savedLayout === 'standard' || savedLayout === 'ipod') {
        setLayoutState(savedLayout);
      }
      if (savedIpod) {
        try {
          const parsed = JSON.parse(savedIpod) as Partial<IpodPalette>;
          if (
            parsed &&
            isHex(String(parsed.wheelColor ?? '')) &&
            isHex(String(parsed.screenBg ?? '')) &&
            isHex(String(parsed.screenText ?? '')) &&
            isHex(String(parsed.highlight ?? ''))
          ) {
            setIpodStored(parsed as IpodPalette);
          }
        } catch {}
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

  const setIpodPalette = async (patch: PalettePatch) => {
    const next = { ...effectiveIpodPalette(theme, ipodStored), ...patch };
    try {
      await AsyncStorage.setItem(IPOD_KEY, JSON.stringify(next));
      setIpodStored(next);
    } catch (error) {
      console.error('Error saving iPod palette:', error);
    }
  };

  const resetIpodPalette = async () => {
    try {
      await AsyncStorage.removeItem(IPOD_KEY);
      setIpodStored(null);
    } catch (error) {
      console.error('Error resetting iPod palette:', error);
    }
  };

  const isDark = theme !== 'light';

  const ipod = effectiveIpodPalette(theme, ipodStored);

  const colors: ThemeColors = useMemo(
    () => (layout === 'ipod' ? ipodColors(ipod) : themes[theme]),
    [layout, ipod, theme]
  );

  const value: ThemeContextType = useMemo(
    () => ({ theme, colors, setTheme, isDark, layout, setLayout, ipod, setIpodPalette, resetIpodPalette }),
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