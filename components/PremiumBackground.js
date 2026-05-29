import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';

import { Theme } from '@/constants/theme';

export default function PremiumBackground({
  children,
  variant = 'default',
  style,
}) {
  const drift = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(drift, {
          toValue: 1,
          duration: 9000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(drift, {
          toValue: 0,
          duration: 9000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    ).start();
  }, [drift]);

  const orb1Y = drift.interpolate({ inputRange: [0, 1], outputRange: [0, 18] });
  const orb2Y = drift.interpolate({ inputRange: [0, 1], outputRange: [0, -14] });

  const orbColor =
    variant === 'mate'
      ? Theme.colors.mateGlow
      : variant === 'passenger'
        ? Theme.colors.passengerGlow
        : 'rgba(243,111,33,0.22)';

  const orbColor2 = 'rgba(243,111,33,0.08)';

  return (
    <View style={[styles.root, style]}>
      <LinearGradient
        colors={Theme.gradients.screen}
        style={StyleSheet.absoluteFill}
        start={{ x: 0.2, y: 0 }}
        end={{ x: 0.8, y: 1 }}
      />
      <Animated.View
        style={[
          styles.orb,
          styles.orbTop,
          { backgroundColor: orbColor, transform: [{ translateY: orb1Y }] },
        ]}
      />
      <Animated.View
        style={[
          styles.orb,
          styles.orbBottom,
          { backgroundColor: orbColor2, transform: [{ translateY: orb2Y }] },
        ]}
      />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Theme.colors.bg },
  orb: { position: 'absolute', borderRadius: 999 },
  orbTop: { width: 280, height: 280, top: -80, right: -60, opacity: 0.55 },
  orbBottom: { width: 220, height: 220, bottom: 120, left: -70, opacity: 0.45 },
});
