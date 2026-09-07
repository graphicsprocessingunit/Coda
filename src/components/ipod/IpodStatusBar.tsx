import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Battery from 'expo-battery';
import { IPOD_SCREEN, SCREEN_TOP_BAR_HEIGHT } from './ipodTheme';

interface IpodStatusBarProps {
  title?: string;
  dark?: boolean;
  shuffle?: boolean;
  repeat?: boolean;
  loading?: boolean;
}

/**
 * The classic top strip: menu title on the left, battery icon on the right,
 * with optional shuffle/repeat indicators. `dark` is used on the black
 * Now Playing screen.
 */
export function IpodStatusBar({ title, dark, shuffle, repeat, loading }: IpodStatusBarProps) {
  const { batteryLevel, batteryState } = Battery.usePowerState();

  const fg = dark ? '#FFFFFF' : IPOD_SCREEN.text;
  const dim = dark ? 'rgba(255,255,255,0.55)' : IPOD_SCREEN.secondary;
  const level = batteryLevel >= 0 ? Math.min(1, Math.max(0, batteryLevel)) : 1;
  const pct = Math.round(level * 100);
  const charging =
    batteryState === Battery.BatteryState.CHARGING || batteryState === Battery.BatteryState.FULL;

  return (
    <View style={styles.bar} pointerEvents="none">
      <Text style={[styles.title, { color: fg }]} numberOfLines={1}>
        {title ?? ''}
      </Text>
      <View style={styles.right}>
        {shuffle || repeat ? (
          <>
            {shuffle ? <Text style={[styles.modeText, { color: dim }]}>SHUFFLE</Text> : null}
            {repeat ? <Text style={[styles.modeText, { color: dim }]}>REPEAT</Text> : null}
          </>
        ) : null}
        {loading ? <ActivityIndicator size="small" color={fg} style={styles.spinner} /> : null}
        {charging ? <Ionicons name="flash" size={9} color={fg} style={styles.bolt} /> : null}
        <View style={[styles.battery, { borderColor: fg }]}>
          <View style={styles.batteryTrack}>
            <View style={[styles.batteryFill, { backgroundColor: fg, width: `${pct}%` }]} />
          </View>
        </View>
        <View style={[styles.batteryNub, { backgroundColor: fg }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    height: SCREEN_TOP_BAR_HEIGHT,
    paddingHorizontal: 10,
  },
  title: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  modeText: {
    fontSize: 9,
    letterSpacing: 0.6,
    marginRight: 7,
    fontWeight: '600',
  },
  spinner: {
    marginRight: 8,
    transform: [{ scale: 0.7 }],
  },
  battery: {
    width: 22,
    height: 11,
    borderWidth: 1.5,
    borderRadius: 2.5,
    padding: 1.5,
  },
  batteryTrack: {
    flex: 1,
  },
  batteryFill: {
    height: '100%',
    borderRadius: 1,
  },
  bolt: {
    marginRight: 3,
  },
  batteryNub: {
    width: 2,
    height: 5,
    borderTopRightRadius: 1,
    borderBottomRightRadius: 1,
    marginLeft: 1,
  },
});