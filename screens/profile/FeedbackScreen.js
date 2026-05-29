import { Ionicons } from '@expo/vector-icons';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import ProfileHeader from '@/components/ProfileHeader';
import { APP_NAME, FEEDBACK_EMAIL, SUPPORT_PHONE, SUPPORT_PHONE_DISPLAY } from '@/constants/appInfo';
import { TAB_BAR_CLEARANCE } from '@/constants/layout';
import { Theme } from '@/constants/theme';

export default function FeedbackScreen({ navigation }) {
  const openEmail = () => {
    const subject = encodeURIComponent(`${APP_NAME} feedback`);
    const body = encodeURIComponent(
      'Tell us what you liked or what we should improve:\n\n',
    );
    Linking.openURL(`mailto:${FEEDBACK_EMAIL}?subject=${subject}&body=${body}`).catch(() => {
      Alert.alert('Email not available', `Send feedback to ${FEEDBACK_EMAIL}`);
    });
  };

  const openSms = () => {
    Linking.openURL(`sms:${SUPPORT_PHONE}?body=${encodeURIComponent('TrotroOS feedback: ')}`).catch(() => {});
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ProfileHeader navigation={navigation} title="Send Feedback" />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.intro}>
          Your feedback shapes {APP_NAME}. Report bugs, suggest routes, or share ideas for Kumasi riders.
        </Text>

        <Pressable onPress={openEmail} style={({ pressed }) => [styles.primaryBtn, pressed && { opacity: 0.85 }]}>
          <Ionicons name="mail-outline" size={20} color="#FFFFFF" />
          <Text style={styles.primaryText}>Email us</Text>
        </Pressable>

        <Pressable onPress={openSms} style={({ pressed }) => [styles.secondaryBtn, pressed && { opacity: 0.85 }]}>
          <Ionicons name="chatbubble-outline" size={18} color={Theme.colors.mate} />
          <Text style={styles.secondaryText}>SMS · {SUPPORT_PHONE_DISPLAY}</Text>
        </Pressable>

        <View style={styles.noteCard}>
          <Ionicons name="information-circle-outline" size={18} color={Theme.colors.textMuted} />
          <Text style={styles.note}>
            Include your route and app version if reporting a bug. We typically reply within one business day.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Theme.colors.bgElevated },
  content: { padding: 20, paddingBottom: TAB_BAR_CLEARANCE },
  intro: { color: Theme.colors.textSub, fontSize: 14, lineHeight: 22, marginBottom: 20 },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: Theme.colors.mate,
    borderRadius: 14,
    minHeight: 52,
    marginBottom: 12,
  },
  primaryText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 14,
    minHeight: 50,
    borderWidth: 1,
    borderColor: 'rgba(243,111,33,0.45)',
    marginBottom: 20,
  },
  secondaryText: { color: Theme.colors.mate, fontSize: 15, fontWeight: '700' },
  noteCard: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: Theme.colors.surface,
    borderRadius: Theme.radius.lg,
    padding: 14,
    borderWidth: 1,
    borderColor: Theme.colors.border,
  },
  note: { flex: 1, color: Theme.colors.textSub, fontSize: 13, lineHeight: 19 },
});
