import { Ionicons } from '@expo/vector-icons';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import ProfileHeader from '@/components/ProfileHeader';
import { TAB_BAR_CLEARANCE } from '@/constants/layout';
import { Theme } from '@/constants/theme';

const TIPS = [
  {
    icon: 'location-outline',
    title: 'Meet at the station',
    body: 'Use well-lit, busy trotro stations. Share your live location only while you have an active reservation.',
  },
  {
    icon: 'car-outline',
    title: 'Verify the vehicle',
    body: 'Check the plate number shown in the app matches the vehicle before you board.',
  },
  {
    icon: 'time-outline',
    title: 'Reservation window',
    body: 'Arrive within 10 minutes of reserving. If plans change, cancel so another passenger can take the seat.',
  },
  {
    icon: 'call-outline',
    title: 'Need help on a trip?',
    body: 'Use Profile → Contact Support or alert station officials in an emergency. Call emergency services (191 / 112) for serious incidents.',
  },
  {
    icon: 'shield-checkmark-outline',
    title: 'For mates',
    body: 'Drive within speed limits, keep seat counts accurate, and end trips in the app when you finish the route.',
  },
];

export default function SafetyScreen({ navigation }) {
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ProfileHeader navigation={navigation} title="Safety" />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Pressable
          onPress={() => navigation.navigate('SafetyReport')}
          style={({ pressed }) => [styles.reportBtn, pressed && { opacity: 0.9 }]}>
          <Ionicons name="flag-outline" size={18} color="#fff" />
          <Text style={styles.reportBtnText}>Report an issue or dispute</Text>
        </Pressable>
        <View style={styles.banner}>
          <Ionicons name="shield-checkmark" size={28} color={Theme.colors.success} />
          <Text style={styles.bannerTitle}>Travel safely with TrotroOS</Text>
          <Text style={styles.bannerSub}>
            Practical tips for passengers and mates across Kumasi.
          </Text>
        </View>
        {TIPS.map((tip) => (
          <View key={tip.title} style={styles.card}>
            <View style={styles.iconWrap}>
              <Ionicons name={tip.icon} size={20} color={Theme.colors.passenger} />
            </View>
            <View style={styles.cardText}>
              <Text style={styles.cardTitle}>{tip.title}</Text>
              <Text style={styles.cardBody}>{tip.body}</Text>
            </View>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Theme.colors.bgElevated },
  content: { padding: 20, paddingBottom: TAB_BAR_CLEARANCE },
  reportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Theme.colors.danger,
    borderRadius: 12,
    paddingVertical: 14,
    marginBottom: 16,
  },
  reportBtnText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  banner: {
    backgroundColor: Theme.colors.successSoft,
    borderRadius: Theme.radius.lg,
    padding: 18,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.25)',
    alignItems: 'center',
  },
  bannerTitle: { color: Theme.colors.text, fontSize: 17, fontWeight: '800', marginTop: 10 },
  bannerSub: { color: Theme.colors.textSub, fontSize: 13, textAlign: 'center', marginTop: 6, lineHeight: 19 },
  card: {
    flexDirection: 'row',
    gap: 14,
    backgroundColor: Theme.colors.surface,
    borderRadius: Theme.radius.lg,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: Theme.colors.border,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Theme.colors.passengerSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardText: { flex: 1 },
  cardTitle: { color: Theme.colors.text, fontSize: 15, fontWeight: '700' },
  cardBody: { color: Theme.colors.textSub, fontSize: 13, lineHeight: 19, marginTop: 4 },
});
