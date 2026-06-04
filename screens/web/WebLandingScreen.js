import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRef } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import TrotroLogo from '@/components/TrotroLogo';
import { formatRoute, routes } from '@/constants/routes';
import { Theme } from '@/constants/theme';
import { APP_CITY, APP_TAGLINE } from '@/constants/appInfo';

const FEATURES = [
  { icon: 'map', title: 'Live map', text: 'See vehicles on your route in real time' },
  { icon: 'ticket', title: 'Reserve a seat', text: 'Hold your spot for 10 minutes' },
  { icon: 'navigate', title: 'Track your ride', text: 'Follow your mate after you book' },
  { icon: 'shield-checkmark', title: 'Built for Ghana', text: 'Kumasi routes · GHS fares · pay on board' },
];

const POPULAR = routes.slice(0, 6);

export default function WebLandingScreen({ onBookRide }) {
  const scrollRef = useRef(null);

  const scrollToBook = () => {
    onBookRide?.();
  };

  return (
    <View style={styles.root}>
      <LinearGradient colors={['#121212', '#1a1208', '#121212']} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <ScrollView ref={scrollRef} contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <View style={styles.nav}>
            <TrotroLogo size="sm" />
            <Pressable onPress={scrollToBook} style={({ pressed }) => [styles.navCta, pressed && { opacity: 0.9 }]}>
              <Text style={styles.navCtaText}>Find a ride</Text>
            </Pressable>
          </View>

          <View style={styles.hero}>
            <Text style={styles.heroBadge}>Passenger web · {APP_CITY}</Text>
            <Text style={styles.heroTitle}>Real-time trotro seats,{'\n'}right from your browser</Text>
            <Text style={styles.heroSub}>{APP_TAGLINE}. Search a route, reserve a seat, and track your ride live.</Text>
            <Pressable
              onPress={scrollToBook}
              style={({ pressed }) => [styles.heroBtn, pressed && { opacity: 0.92 }]}>
              <Ionicons name="search" size={20} color="#FFFFFF" />
              <Text style={styles.heroBtnText}>Book a ride now</Text>
            </Pressable>
            <Text style={styles.heroNote}>Mates — use the Android app to drive and broadcast GPS.</Text>
          </View>

          <View style={styles.featureGrid}>
            {FEATURES.map((f) => (
              <View key={f.title} style={styles.featureCard}>
                <View style={styles.featureIcon}>
                  <Ionicons name={f.icon} size={22} color={Theme.colors.passengerMap} />
                </View>
                <Text style={styles.featureTitle}>{f.title}</Text>
                <Text style={styles.featureText}>{f.text}</Text>
              </View>
            ))}
          </View>

          <Text style={styles.sectionTitle}>Popular routes</Text>
          <View style={styles.routeRow}>
            {POPULAR.map((r) => (
              <View key={r.id} style={styles.routeChip}>
                <Text style={styles.routeChipText} numberOfLines={1}>{formatRoute(r)}</Text>
                <Text style={styles.routeFare}>GHS {r.fareGhs}</Text>
              </View>
            ))}
          </View>

          <View style={styles.appRow}>
            <View style={styles.appCard}>
              <Ionicons name="phone-portrait-outline" size={28} color={Theme.colors.primary} />
              <View style={styles.appCardText}>
                <Text style={styles.appCardTitle}>Get the Android app</Text>
                <Text style={styles.appCardSub}>Best experience for mates and offline-ready passengers</Text>
              </View>
            </View>
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Copyright TrotroOS. Secure. Real-time. Foreground GPS only.</Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Theme.colors.bg },
  safe: { flex: 1 },
  scroll: { paddingHorizontal: 24, paddingBottom: 48, maxWidth: 960, width: '100%', alignSelf: 'center' },
  nav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 16 },
  navCta: {
    backgroundColor: Theme.colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
  },
  navCtaText: { color: '#FFFFFF', fontWeight: '800', fontSize: 13 },
  hero: { paddingVertical: 32, gap: 16 },
  heroBadge: {
    alignSelf: 'flex-start',
    color: Theme.colors.passengerMap,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    backgroundColor: 'rgba(102,187,106,0.12)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    overflow: 'hidden',
  },
  heroTitle: { color: Theme.colors.text, fontSize: 36, fontWeight: '900', lineHeight: 42, letterSpacing: -0.5 },
  heroSub: { color: Theme.colors.textSub, fontSize: 16, lineHeight: 24, maxWidth: 560 },
  heroBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 10,
    backgroundColor: Theme.colors.passengerMap,
    paddingHorizontal: 22,
    paddingVertical: 14,
    borderRadius: 14,
    marginTop: 8,
  },
  heroBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  heroNote: { color: Theme.colors.textMuted, fontSize: 12, marginTop: 4 },
  featureGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 32,
  },
  featureCard: {
    flex: 1,
    minWidth: 200,
    backgroundColor: Theme.colors.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Theme.colors.border,
  },
  featureIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(102,187,106,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  featureTitle: { color: Theme.colors.text, fontSize: 15, fontWeight: '800', marginBottom: 4 },
  featureText: { color: Theme.colors.textSub, fontSize: 13, lineHeight: 18 },
  sectionTitle: { color: Theme.colors.text, fontSize: 18, fontWeight: '800', marginBottom: 12 },
  routeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 32 },
  routeChip: {
    backgroundColor: Theme.colors.surface,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    maxWidth: '48%',
  },
  routeChipText: { color: Theme.colors.text, fontSize: 12, fontWeight: '700' },
  routeFare: { color: Theme.colors.primary, fontSize: 11, fontWeight: '800', marginTop: 2 },
  appRow: { marginBottom: 24 },
  appCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: Theme.colors.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Theme.colors.border,
  },
  appCardText: { flex: 1 },
  appCardTitle: { color: Theme.colors.text, fontSize: 15, fontWeight: '800' },
  appCardSub: { color: Theme.colors.textSub, fontSize: 12, marginTop: 4 },
  footer: { paddingTop: 16, borderTopWidth: 1, borderTopColor: Theme.colors.border },
  footerText: { color: Theme.colors.textMuted, fontSize: 11, textAlign: 'center' },
});
