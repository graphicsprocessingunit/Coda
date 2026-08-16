import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type Theme = 'dark' | 'light' | 'midnight' | 'ocean';

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

interface ThemeContextType {
  theme: Theme;
  colors: ThemeColors;
  setTheme: (theme: Theme) => void;
  isDark: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const STORAGE_KEY = '@coda_theme';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('dark');

  useEffect(() => {
    loadTheme();
  }, []);

  const loadTheme = async () => {
    try {
      const savedTheme = await AsyncStorage.getItem(STORAGE_KEY);
      if (savedTheme && themes[savedTheme as Theme]) {
        setThemeState(savedTheme as Theme);
      }
    } catch (error) {
      console.error('Error loading theme:', error);
    }
  };

  const setTheme = async (newTheme: Theme) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, newTheme);
      setThemeState(newTheme);
    } catch (error) {
      console.error('Error saving theme:', error);
    }
  };

  const isDark = theme !== 'light';

  const value: ThemeContextType = useMemo(() => ({
    theme,
    colors: themes[theme],
    setTheme,
    isDark,
  }), [theme, isDark]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
