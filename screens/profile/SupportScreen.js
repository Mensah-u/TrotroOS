import { Ionicons } from '@expo/vector-icons';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import ProfileHeader from '@/components/ProfileHeader';
import {
  APP_CITY,
  APP_NAME,
  APP_VERSION,
  SUPPORT_HOURS,
  SUPPORT_PHONE,
  SUPPORT_PHONE_DISPLAY,
} from '@/constants/appInfo';
import { TAB_BAR_CLEARANCE } from '@/constants/layout';
import { Theme } from '@/constants/theme';

const C = {
  BG: '#121212', SURFACE: '#1E1E1E', BORDER: 'rgba(255,255,255,0.07)',
  ACCENT: '#F36F21', TEXT: '#FFFFFF', TEXT_SUB: '#E0E0E0', TEXT_MUTED: '#A8A8A8',
};

const FAQ = [
  { q: 'How do I reserve a seat?', a: 'Open Find Ride, pick a live trip, and tap Reserve Seat. Be at the origin station before your reservation expires (10 minutes).' },
  { q: 'Do I need an account?', a: 'No — passengers ride anonymously. Mates (drivers) sign up on the Mate tab.' },
  { q: 'Why does TrotroOS need my location?', a: 'So the mate can see where you are waiting on the map. You can turn this off in Profile → Privacy.' },
  { q: 'How do I rate my driver?', a: 'After your trip ends, a rating popup appears automatically. You can also view past ratings under Profile → My Ratings.' },
  { q: 'Is payment handled in the app?', a: 'Not yet — pay your mate in cash (mobile money coming soon).' },
  { q: 'How do I contact support?', a: 'Profile → Contact Support, or call the support line. Hours: Mon–Sat, 7 AM – 9 PM.' },
  { q: 'Can I drive as a mate?', a: 'Yes — Profile → Switch to Mate, create a mate account, and publish live trips from the Dashboard.' },
];

export default function SupportScreen({ navigation, route }) {
  const section = route.params?.section ?? 'all';

  const callSupport = () => Linking.openURL(`tel:${SUPPORT_PHONE}`).catch(() => {});
  const smsSupport = () => Linking.openURL(`sms:${SUPPORT_PHONE}`).catch(() => {});

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ProfileHeader navigation={navigation} title="Support" />
      <ScrollView contentContainerStyle={styles.content}>

        {(section === 'all' || section === 'contact') ? (
          <View style={styles.contactCard}>
            <View style={styles.contactHeader}>
              <Ionicons name="headset" size={24} color={C.ACCENT} />
              <Text style={styles.contactTitle}>Contact Support</Text>
            </View>
            <Text style={styles.contactSub}>Need help? Call or message the {APP_NAME} team.</Text>
            <Text style={styles.contactHours}>{SUPPORT_HOURS}</Text>
            <Pressable onPress={callSupport} style={({ pressed }) => [styles.phoneBtn, pressed && { opacity: 0.85 }]}>
              <Ionicons name="call" size={20} color="#FFFFFF" />
              <Text style={styles.phoneText}>{SUPPORT_PHONE_DISPLAY}</Text>
            </Pressable>
            <Pressable onPress={smsSupport} style={({ pressed }) => [styles.smsBtn, pressed && { opacity: 0.85 }]}>
              <Ionicons name="chatbubble-outline" size={18} color={C.ACCENT} />
              <Text style={styles.smsText}>Send SMS</Text>
            </Pressable>
          </View>
        ) : null}

        {(section === 'all' || section === 'faq') ? (
          <>
            <Text style={styles.sectionLabel}>HELP & FAQ</Text>
            {FAQ.map((item) => (
              <View key={item.q} style={styles.faqCard}>
                <Text style={styles.faqQ}>{item.q}</Text>
                <Text style={styles.faqA}>{item.a}</Text>
              </View>
            ))}
          </>
        ) : null}

        {(section === 'all' || section === 'about') ? (
          <View style={styles.aboutCard}>
            <Ionicons name="bus" size={28} color={C.ACCENT} />
            <Text style={styles.aboutTitle}>TrotroOS</Text>
            <Text style={styles.aboutSub}>Version {APP_VERSION} · {APP_CITY}</Text>
            <Text style={styles.aboutBody}>
              Real-time trotro seats, live maps, and demand queues — built for everyday riders and mates in Kumasi.
            </Text>
            <Pressable
              onPress={() => navigation.navigate('About')}
              style={({ pressed }) => [styles.linkBtn, pressed && { opacity: 0.8 }]}>
              <Text style={styles.linkBtnText}>Full about page</Text>
              <Ionicons name="chevron-forward" size={14} color={Theme.colors.mate} />
            </Pressable>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.BG },
  content: { padding: 20, paddingBottom: TAB_BAR_CLEARANCE },
  contactCard: { backgroundColor: C.SURFACE, borderRadius: 16, padding: 20, marginBottom: 24, borderWidth: 1, borderColor: 'rgba(243,111,33,0.3)' },
  contactHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 },
  contactTitle: { color: C.TEXT, fontSize: 18, fontWeight: '800' },
  contactSub: { color: C.TEXT_SUB, fontSize: 13, marginBottom: 6 },
  contactHours: { color: C.TEXT_MUTED, fontSize: 12, marginBottom: 16 },
  phoneBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: C.ACCENT, borderRadius: 14, minHeight: 52, marginBottom: 10 },
  phoneText: { color: '#FFFFFF', fontSize: 18, fontWeight: '800', letterSpacing: 0.5 },
  smsBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 14, minHeight: 48, borderWidth: 1, borderColor: 'rgba(243,111,33,0.5)' },
  smsText: { color: C.ACCENT, fontSize: 15, fontWeight: '700' },
  sectionLabel: { color: C.TEXT_MUTED, fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 10 },
  faqCard: { backgroundColor: C.SURFACE, borderRadius: 14, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: C.BORDER },
  faqQ: { color: C.TEXT, fontSize: 14, fontWeight: '700', marginBottom: 6 },
  faqA: { color: C.TEXT_SUB, fontSize: 13, lineHeight: 19 },
  aboutCard: { alignItems: 'center', backgroundColor: C.SURFACE, borderRadius: 16, padding: 24, marginTop: 16, borderWidth: 1, borderColor: C.BORDER },
  aboutTitle: { color: C.TEXT, fontSize: 20, fontWeight: '800', marginTop: 8 },
  aboutSub: { color: C.TEXT_MUTED, fontSize: 13, marginTop: 4 },
  aboutBody: { color: C.TEXT_SUB, fontSize: 13, textAlign: 'center', marginTop: 12, lineHeight: 19 },
  linkBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 14 },
  linkBtnText: { color: Theme.colors.mate, fontSize: 14, fontWeight: '700' },
});
