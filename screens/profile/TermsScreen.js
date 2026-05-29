import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import ProfileHeader from '@/components/ProfileHeader';
import { APP_NAME } from '@/constants/appInfo';
import { TAB_BAR_CLEARANCE } from '@/constants/layout';
import { Theme } from '@/constants/theme';

const SECTIONS = [
  {
    title: '1. Acceptance',
    body: `By using ${APP_NAME}, you agree to these terms. If you do not agree, please do not use the app.`,
  },
  {
    title: '2. Service description',
    body: `${APP_NAME} helps passengers find live trotro trips and helps mates publish seat availability. We do not operate vehicles and are not a transport carrier.`,
  },
  {
    title: '3. Passenger use',
    body: 'Reservations are held for a limited time. You must arrive at the agreed pickup point on time. Pay your fare directly to the mate unless another payment method is offered in-app.',
  },
  {
    title: '4. Mate (driver) use',
    body: 'You are responsible for accurate seat counts, safe driving, valid licensing, and compliance with local transport regulations. Misleading availability may result in account suspension.',
  },
  {
    title: '5. Location data',
    body: 'The app may collect location data to show live positions on the map. You can adjust sharing preferences in Profile → Privacy.',
  },
  {
    title: '6. Liability',
    body: 'Trips are arranged between passengers and mates. TrotroOS is provided "as is" without warranties. We are not liable for delays, accidents, or disputes arising from a trip.',
  },
  {
    title: '7. Changes',
    body: 'We may update these terms. Continued use after changes means you accept the updated terms.',
  },
  {
    title: '8. Contact',
    body: 'Questions about these terms? Use Profile → Help & Support or call the support line listed in the app.',
  },
];

export default function TermsScreen({ navigation }) {
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ProfileHeader navigation={navigation} title="Terms of Service" />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.updated}>Last updated · May 2026</Text>
        {SECTIONS.map((s) => (
          <View key={s.title} style={styles.block}>
            <Text style={styles.blockTitle}>{s.title}</Text>
            <Text style={styles.blockBody}>{s.body}</Text>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Theme.colors.bgElevated },
  content: { padding: 20, paddingBottom: TAB_BAR_CLEARANCE },
  updated: { color: Theme.colors.textMuted, fontSize: 12, fontWeight: '600', marginBottom: 16 },
  block: { marginBottom: 18 },
  blockTitle: { color: Theme.colors.text, fontSize: 15, fontWeight: '800', marginBottom: 6 },
  blockBody: { color: Theme.colors.textSub, fontSize: 14, lineHeight: 22 },
});
