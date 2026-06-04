import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';

import { Theme, glowShadow } from '@/constants/theme';

export default function TrotroLogo({ size = 'md', showTagline = false }) {
  const pulse = useRef(new Animated.Value(0)).current;
  const ring = useRef(new Animated.Value(0)).current;

  const dims = size === 'lg'
    ? { box: 88, icon: 40, radius: 26 }
    : size === 'sm'
      ? { box: 52, icon: 24, radius: 16 }
      : { box: 72, icon: 32, radius: 22 };

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1400, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 1400, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    ).start();
    Animated.loop(
      Animated.timing(ring, { toValue: 1, duration: 2200, easing: Easing.out(Easing.ease), useNativeDriver: true }),
    ).start();
  }, [pulse, ring]);

  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] });
  const ringScale = ring.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1.6] });
  const ringOpacity = ring.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] });

  return (
    <View style={styles.wrap}>
      <View style={[styles.iconStage, { width: dims.box + 24, height: dims.box + 24 }]}>
        <Animated.View
          style={[
            styles.ring,
            {
              width: dims.box + 24,
              height: dims.box + 24,
              borderRadius: (dims.box + 24) / 2,
              transform: [{ scale: ringScale }],
              opacity: ringOpacity,
            },
          ]}
        />
        <Animated.View style={{ transform: [{ scale }] }}>
          <LinearGradient
            colors={['#FB923C', '#EA580C']}
            style={[
              styles.iconBox,
              { width: dims.box, height: dims.box, borderRadius: dims.radius },
              glowShadow(Theme.colors.mate, 0.35),
            ]}>
            <Ionicons name="bus" size={dims.icon} color="#FFFFFF" />
          </LinearGradient>
        </Animated.View>
      </View>
      <Text style={[styles.brand, size === 'lg' && styles.brandLg]}>TrotroOS</Text>
      {showTagline ? (
        <Text style={styles.tagline}>Kumasi · Real-time mobility</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center' },
  iconStage: { alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  ring: {
    position: 'absolute',
    backgroundColor: Theme.colors.mateSoft,
    borderWidth: 1,
    borderColor: 'rgba(243,111,33,0.25)',
  },
  iconBox: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  brand: { color: Theme.colors.text, fontSize: 28, fontWeight: '900', letterSpacing: -0.8 },
  brandLg: { fontSize: 36, letterSpacing: -1.2 },
  tagline: { color: Theme.colors.textMuted, fontSize: 13, fontWeight: '600', marginTop: 6 },
});
