import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef } from 'react';
import { Animated, Easing, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import GlassCard from '@/components/GlassCard';
import PremiumBackground from '@/components/PremiumBackground';
import TrotroLogo from '@/components/TrotroLogo';
import { SCREEN_SCROLL_BOTTOM } from '@/constants/layout';
import { Theme } from '@/constants/theme';
import { ROLES } from '@/services/appRole';
import { WELCOME } from '@/constants/problemSolution';

const STATS = [
  { value: 'Live', label: 'See trotros' },
  { value: '10 min', label: 'Hold a seat' },
  { value: 'GHS 3+', label: 'Know the fare' },
];

export default function WelcomeScreen({ onSelectRole }) {
  const fade = useRef(new Animated.Value(0)).current;
  const rise = useRef(new Animated.Value(24)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 700, useNativeDriver: true }),
      Animated.timing(rise, { toValue: 0, duration: 700, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
  }, [fade, rise]);

  return (
    <PremiumBackground>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <Animated.View style={{ opacity: fade, transform: [{ translateY: rise }] }}>
            <View style={styles.hero}>
              <TrotroLogo size="lg" showTagline />
              <View style={styles.statsRow}>
                {STATS.map((s, i) => (
                  <View key={s.label} style={[styles.stat, i > 0 && styles.statBorder]}>
                    <Text style={styles.statValue}>{s.value}</Text>
                    <Text style={styles.statLabel}>{s.label}</Text>
                  </View>
                ))}
              </View>
            </View>

            <Text style={styles.problemLine}>{WELCOME.problemLine}</Text>
            <Text style={styles.heading}>How can we help?</Text>
            <Text style={styles.subheading}>
              Pick the job you need done right now.
            </Text>

            <View style={styles.cards}>
              <GlassCard
                title={WELCOME.passengerTitle}
                subtitle={WELCOME.passengerSubtitle}
                icon="person"
                iconColor={Theme.colors.passengerMap}
                gradientColors={Theme.gradients.passengerCard}
                badge="RIDE"
                features={['Live map on your route', 'One-tap reserve', 'Track your trotro']}
                onPress={() => onSelectRole(ROLES.PASSENGER)}
              />
              <GlassCard
                title={WELCOME.mateTitle}
                subtitle={WELCOME.mateSubtitle}
                icon="bus"
                iconColor={Theme.colors.mateMap}
                gradientColors={Theme.gradients.mateCard}
                badge="DRIVE"
                features={['Start route once', 'See waiting passengers', 'Track earnings']}
                onPress={() => onSelectRole(ROLES.MATE)}
              />
            </View>

            <View style={styles.trustRow}>
              <Ionicons name="shield-checkmark" size={16} color={Theme.colors.success} />
              <Text style={styles.trustText}>Secure · Real-time · Built for Ghana</Text>
            </View>
          </Animated.View>
        </ScrollView>
      </SafeAreaView>
    </PremiumBackground>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { paddingHorizontal: 24, paddingBottom: SCREEN_SCROLL_BOTTOM },
  hero: { alignItems: 'center', paddingTop: 20, paddingBottom: 28 },
  statsRow: {
    flexDirection: 'row',
    marginTop: 24,
    backgroundColor: Theme.colors.glass,
    borderRadius: Theme.radius.lg,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    overflow: 'hidden',
    width: '100%',
  },
  stat: { flex: 1, alignItems: 'center', paddingVertical: 14 },
  statBorder: { borderLeftWidth: 1, borderLeftColor: Theme.colors.border },
  statValue: { color: Theme.colors.text, fontSize: 16, fontWeight: '900' },
  statLabel: { color: Theme.colors.textMuted, fontSize: 10, fontWeight: '700', marginTop: 3, textAlign: 'center' },
  problemLine: {
    color: Theme.colors.passengerMap,
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 22,
    marginBottom: 16,
    textAlign: 'center',
  },
  heading: { color: Theme.colors.text, fontSize: 24, fontWeight: '900', letterSpacing: -0.5 },
  subheading: { color: Theme.colors.textSub, fontSize: 14, lineHeight: 21, marginTop: 8, marginBottom: 22 },
  cards: { gap: 16 },
  trustRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 24,
    paddingVertical: 12,
  },
  trustText: { color: Theme.colors.textMuted, fontSize: 12, fontWeight: '700' },
});
