import { useEffect } from 'react';
import { SharedValue, useSharedValue, withTiming } from 'react-native-reanimated';

export function useAnimatedColor(color: string, duration = 450): SharedValue<string> {
  const value = useSharedValue(color);

  useEffect(() => {
    value.value = withTiming(color, { duration });
  }, [color, duration]);

  return value;
}
