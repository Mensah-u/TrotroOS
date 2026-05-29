import { Ionicons } from '@expo/vector-icons';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import ProfileHeader from '@/components/ProfileHeader';
import {
  APP_CITY,
  APP_NAME,
  APP_TAGLINE,
  APP_VERSION,
  SUPPORT_HOURS,
  SUPPORT_PHONE_DISPLAY,
} from '@/constants/appInfo';
import { TAB_BAR_CLEARANCE } from '@/constants/layout';
import { Theme } from '@/constants/theme';

const FEATURES = [
  { icon: 'radio-outline', title: 'Live seat counts', body: 'See available seats before you walk to the station.' },
  { icon: 'map-outline', title: 'Real-time maps', body: 'Track your mate and share your pickup location when reserved.' },
  { icon: 'people-outline', title: 'Built for Kumasi', body: 'Routes and fares tuned for everyday trotro and bus travel.' },
];

export default function AboutScreen({ navigation }) {
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ProfileHeader navigation={navigation} title="About" />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <View style={styles.logoRing}>
            <Ionicons name="bus" size={36} color={Theme.colors.mate} />
          </View>
          <Text style={styles.title}>{APP_NAME}</Text>
          <Text style={styles.tagline}>{APP_TAGLINE}</Text>
          <Text style={styles.version}>Version {APP_VERSION} · {APP_CITY}</Text>
        </View>

        <Text style={styles.sectionLabel}>WHAT WE DO</Text>
        <Text style={styles.body}>
          TrotroOS connects passengers and mates (drivers) with live trips, reservations, and
          transparent seat availability — reducing uncertainty at the station.
        </Text>

        <Text style={styles.sectionLabel}>FEATURES</Text>
        {FEATURES.map((f) => (
          <View key={f.title} style={styles.featureCard}>
            <View style={styles.featureIcon}>
              <Ionicons name={f.icon} size={20} color={Theme.colors.mate} />
            </View>
            <View style={styles.featureText}>
              <Text style={styles.featureTitle}>{f.title}</Text>
              <Text style={styles.featureBody}>{f.body}</Text>
            </View>
          </View>
        ))}

        <View style={styles.metaCard}>
          <Text style={styles.metaLabel}>Support hours</Text>
          <Text style={styles.metaValue}>{SUPPORT_HOURS}</Text>
          <Text style={[styles.metaLabel, { marginTop: 14 }]}>Phone</Text>
          <Text style={styles.metaValue}>{SUPPORT_PHONE_DISPLAY}</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Theme.colors.bgElevated },
  content: { padding: 20, paddingBottom: TAB_BAR_CLEARANCE },
  hero: { alignItems: 'center', marginBottom: 24 },
  logoRing: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: Theme.colors.mateSoft,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(249,115,22,0.35)',
    marginBottom: 14,
  },
  title: { color: Theme.colors.text, fontSize: 26, fontWeight: '900', letterSpacing: -0.5 },
  tagline: { color: Theme.colors.textSub, fontSize: 14, marginTop: 6, textAlign: 'center' },
  version: { color: Theme.colors.textMuted, fontSize: 12, marginTop: 8, fontWeight: '600' },
  sectionLabel: {
    color: Theme.colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 10,
    marginTop: 8,
  },
  body: { color: Theme.colors.textSub, fontSize: 14, lineHeight: 22, marginBottom: 20 },
  featureCard: {
    flexDirection: 'row',
    gap: 14,
    backgroundColor: Theme.colors.surface,
    borderRadius: Theme.radius.lg,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: Theme.colors.border,
  },
  featureIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Theme.colors.surfaceUp,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Theme.colors.border,
  },
  featureText: { flex: 1 },
  featureTitle: { color: Theme.colors.text, fontSize: 15, fontWeight: '700' },
  featureBody: { color: Theme.colors.textSub, fontSize: 13, lineHeight: 19, marginTop: 4 },
  metaCard: {
    backgroundColor: Theme.colors.surface,
    borderRadius: Theme.radius.lg,
    padding: 18,
    marginTop: 16,
    borderWidth: 1,
    borderColor: Theme.colors.border,
  },
  metaLabel: { color: Theme.colors.textMuted, fontSize: 11, fontWeight: '700', letterSpacing: 0.8 },
  metaValue: { color: Theme.colors.text, fontSize: 15, fontWeight: '600', marginTop: 4 },
});
