import { requireNativeModule } from 'expo-modules-core';

export interface BandInfo {
  index: number;
  centerFreq: number;
  minGain: number;
  maxGain: number;
}

const AudioEQ = requireNativeModule('AudioEQ');

export function initialize(): Promise<void> {
  return AudioEQ.initialize();
}

export function setBandGain(band: number, gain: number): Promise<void> {
  return AudioEQ.setBandGain(band, gain);
}

export function getBandCount(): Promise<number> {
  return AudioEQ.getBandCount();
}

export function getBandInfo(band: number): Promise<BandInfo> {
  return AudioEQ.getBandInfo(band);
}

export function setEnabled(enabled: boolean): Promise<void> {
  return AudioEQ.setEnabled(enabled);
}

export function teardown(): Promise<void> {
  return AudioEQ.teardown();
}
