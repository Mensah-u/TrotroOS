import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet } from 'react-native';

import { Theme } from '@/constants/theme';

/** Premium shimmer block — use for loading placeholders. */
export function SkeletonBlock({ width = '100%', height = 14, radius = Theme.radius.sm, style }) {
  const pulse = useRef(new Animated.Value(0.35)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 0.85,
          duration: 900,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0.35,
          duration: 900,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [pulse]);

  return (
    <Animated.View
      style={[
        styles.block,
        { width, height, borderRadius: radius, opacity: pulse },
        style,
      ]}
    />
  );
}

export function SkeletonLine({ width = '72%', style }) {
  return <SkeletonBlock width={width} height={12} radius={8} style={style} />;
}

const styles = StyleSheet.create({
  block: {
    backgroundColor: Theme.colors.borderStrong,
  },
});
