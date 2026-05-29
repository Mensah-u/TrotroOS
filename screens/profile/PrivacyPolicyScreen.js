import { Ionicons } from '@expo/vector-icons';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import ProfileHeader from '@/components/ProfileHeader';
import { PRIVACY_POLICY_URL, SUPPORT_EMAIL } from '@/constants/appInfo';
import { SCREEN_GUTTER, TAB_BAR_CLEARANCE } from '@/constants/layout';
import { PRIVACY_POLICY_SECTIONS, PRIVACY_POLICY_UPDATED } from '@/constants/privacyPolicy';
import { Theme } from '@/constants/theme';

export default function PrivacyPolicyScreen({ navigation }) {
  const openHosted = () => {
    if (PRIVACY_POLICY_URL) {
      Linking.openURL(PRIVACY_POLICY_URL).catch(() => {});
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ProfileHeader navigation={navigation} title="Privacy Policy" />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.updated}>Last updated · {PRIVACY_POLICY_UPDATED}</Text>

        {PRIVACY_POLICY_SECTIONS.map((section) => (
          <View key={section.title} style={styles.section}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <Text style={styles.sectionBody}>{section.body}</Text>
          </View>
        ))}

        {PRIVACY_POLICY_URL ? (
          <Pressable onPress={openHosted} style={({ pressed }) => [styles.linkBtn, pressed && { opacity: 0.85 }]}>
            <Ionicons name="open-outline" size={18} color={Theme.colors.passenger} />
            <Text style={styles.linkText}>Open full policy online</Text>
          </Pressable>
        ) : (
          <View style={styles.note}>
            <Ionicons name="information-circle-outline" size={18} color={Theme.colors.textMuted} />
            <Text style={styles.noteText}>
              Questions? Email {SUPPORT_EMAIL}
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Theme.colors.bg },
  content: { paddingHorizontal: SCREEN_GUTTER, paddingBottom: TAB_BAR_CLEARANCE },
  updated: { color: Theme.colors.textMuted, fontSize: 12, fontWeight: '600', marginBottom: 16, marginTop: 4 },
  section: { marginBottom: 20 },
  sectionTitle: { color: Theme.colors.text, fontSize: 16, fontWeight: '800', marginBottom: 6 },
  sectionBody: { color: Theme.colors.textSub, fontSize: 14, lineHeight: 21 },
  linkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Theme.colors.passenger + '55',
    backgroundColor: Theme.colors.passengerSoft,
    marginTop: 8,
  },
  linkText: { color: Theme.colors.passenger, fontSize: 14, fontWeight: '800' },
  note: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', marginTop: 8 },
  noteText: { flex: 1, color: Theme.colors.textMuted, fontSize: 13, lineHeight: 19 },
});
