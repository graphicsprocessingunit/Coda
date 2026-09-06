import { useWindowDimensions, Platform } from 'react-native';

export const TABLET_MIN_WIDTH = 700;

export type Orientation = 'portrait' | 'landscape';

export interface DeviceType {
  isTablet: boolean;
  orientation: Orientation;
  width: number;
  height: number;
}

interface SpacingScale {
  xs: number;
  s: number;
  m: number;
  l: number;
  xl: number;
}

export interface ResponsiveLayout extends DeviceType {
  spacing: SpacingScale;
  contentMaxWidth: number;
  sidebarWidth: number;
  touchTarget: number;
  rowHeight: number;
}

export const phoneTokens = {
  spacing: { xs: 4, s: 8, m: 12, l: 16, xl: 24 },
  contentMaxWidth: 0,
  sidebarWidth: 0,
  touchTarget: 44,
  rowHeight: 56,
};

export const tabletTokens = {
  spacing: { xs: 6, s: 10, m: 16, l: 24, xl: 32 },
  contentMaxWidth: 980,
  sidebarWidth: 240,
  touchTarget: 48,
  rowHeight: 64,
};

function isPadDevice(): boolean {
  return (Platform as { isPad?: boolean }).isPad === true;
}

export function isTabletSize(width: number, isPad: boolean = isPadDevice()): boolean {
  return isPad && width >= TABLET_MIN_WIDTH;
}

export function getOrientation(width: number, height: number): Orientation {
  return width >= height ? 'landscape' : 'portrait';
}

export function tokensFor(isTablet: boolean): Omit<ResponsiveLayout, keyof DeviceType> {
  return isTablet ? tabletTokens : phoneTokens;
}

export function useDeviceType(): DeviceType {
  const { width, height } = useWindowDimensions();
  return {
    isTablet: isTabletSize(width),
    orientation: getOrientation(width, height),
    width,
    height,
  };
}

export function useResponsiveLayout(): ResponsiveLayout {
  const device = useDeviceType();
  return {
    ...device,
    ...tokensFor(device.isTablet),
  };
}