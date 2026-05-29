import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import PremiumBackground from '@/components/PremiumBackground';
import TrotroLogo from '@/components/TrotroLogo';
import { Theme } from '@/constants/theme';

export default function BrandedLoader({ message = 'Loading' }) {
  const fade = useRef(new Animated.Value(0)).current;
  const slide = useRef(new Animated.Value(12)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.timing(slide, { toValue: 0, duration: 600, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
  }, [fade, slide]);

  return (
    <PremiumBackground>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <Animated.View style={[styles.center, { opacity: fade, transform: [{ translateY: slide }] }]}>
          <TrotroLogo size="lg" />
          <Text style={styles.message}>{message}…</Text>
          <View style={styles.dotsRow}>
            {[0, 1, 2].map((i) => (
              <PulsingDot key={i} delay={i * 180} />
            ))}
          </View>
        </Animated.View>
        <Text style={styles.footer}>Premium mobility · Built for Kumasi</Text>
      </SafeAreaView>
    </PremiumBackground>
  );
}

function PulsingDot({ delay }) {
  const v = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(v, { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.timing(v, { toValue: 0.3, duration: 500, useNativeDriver: true }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [delay, v]);

  return <Animated.View style={[styles.dot, { opacity: v }]} />;
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  message: { color: Theme.colors.textSub, fontSize: 15, fontWeight: '600', marginTop: 8 },
  dotsRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: Theme.colors.mate },
  footer: {
    color: Theme.colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    paddingBottom: 24,
    letterSpacing: 0.3,
  },
});
