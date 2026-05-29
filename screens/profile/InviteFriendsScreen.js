import { Ionicons } from '@expo/vector-icons';
import { useCallback, useState } from 'react';
import { Alert, Pressable, Share, StyleSheet, Text, View } from 'react-native';

let Clipboard = null;
try {
  // expo-clipboard is optional; fall back to Share if missing
  Clipboard = require('expo-clipboard');
} catch {
  Clipboard = null;
}
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';

import ProfileHeader from '@/components/ProfileHeader';
import { APP_NAME } from '@/constants/appInfo';
import { TAB_BAR_CLEARANCE } from '@/constants/layout';
import { Theme } from '@/constants/theme';
import { getOrCreateDeviceId } from '@/services/passengerProfile';

const INVITE_URL = 'https://trotroos.app';

function makeReferralCode(seed) {
  if (!seed) return 'KUMASI-RIDE';
  const clean = seed.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  return `TROTRO-${clean.slice(0, 5) || 'KSI01'}`;
}

export default function InviteFriendsScreen({ navigation }) {
  const [referralCode, setReferralCode] = useState('TROTRO-KSI01');
  const [shareCount, setShareCount] = useState(0);

  useFocusEffect(
    useCallback(() => {
      getOrCreateDeviceId().then((id) => setReferralCode(makeReferralCode(id))).catch(() => {});
    }, []),
  );

  const shareMsg = `Try ${APP_NAME} — real-time trotro seats for Kumasi. Use my invite code ${referralCode} when you sign up. ${INVITE_URL}`;

  const share = async () => {
    try {
      await Share.share({
        message: shareMsg,
        title: `${APP_NAME} invite`,
      });
      setShareCount((n) => n + 1);
    } catch {
      // user cancelled
    }
  };

  const copyCode = async () => {
    if (Clipboard?.setStringAsync) {
      try {
        await Clipboard.setStringAsync(referralCode);
        Alert.alert('Copied', `${referralCode} copied to clipboard.`);
        return;
      } catch {}
    }
    try {
      await Share.share({ message: referralCode, title: 'Invite code' });
    } catch {
      Alert.alert('Code', referralCode);
    }
  };

  const copyLink = async () => {
    if (Clipboard?.setStringAsync) {
      try {
        await Clipboard.setStringAsync(INVITE_URL);
        Alert.alert('Copied', `${INVITE_URL} copied to clipboard.`);
        return;
      } catch {}
    }
    try {
      await Share.share({ message: INVITE_URL, title: 'TrotroOS link' });
    } catch {
      Alert.alert('Link', INVITE_URL);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ProfileHeader navigation={navigation} title="Invite Friends" />
      <View style={styles.content}>
        <View style={styles.hero}>
          <View style={styles.heroIcon}>
            <Ionicons name="gift-outline" size={36} color={Theme.colors.gold} />
          </View>
          <Text style={styles.title}>Bring Kumasi onboard</Text>
          <Text style={styles.subtitle}>
            Share {APP_NAME} with friends, family, and your favorite mates. Early adopters get priority access to new features.
          </Text>
        </View>

        <View style={styles.codeCard}>
          <Text style={styles.codeLabel}>YOUR INVITE CODE</Text>
          <Text style={styles.code}>{referralCode}</Text>
          <Pressable onPress={copyCode} style={({ pressed }) => [styles.copyBtn, pressed && { opacity: 0.7 }]}>
            <Ionicons name="copy-outline" size={14} color={Theme.colors.passenger} />
            <Text style={styles.copyText}>Copy code</Text>
          </Pressable>
        </View>

        <Pressable onPress={share} style={({ pressed }) => [styles.primaryBtn, pressed && { opacity: 0.85 }]}>
          <Ionicons name="share-social-outline" size={20} color="#FFFFFF" />
          <Text style={styles.primaryText}>Share via apps</Text>
        </Pressable>

        <Pressable onPress={copyLink} style={({ pressed }) => [styles.secondaryBtn, pressed && { opacity: 0.85 }]}>
          <Ionicons name="link-outline" size={18} color={Theme.colors.passenger} />
          <Text style={styles.secondaryText}>Copy app link</Text>
        </Pressable>

        {shareCount > 0 ? (
          <View style={styles.shareNote}>
            <Ionicons name="checkmark-circle" size={16} color={Theme.colors.success} />
            <Text style={styles.shareNoteText}>
              Shared {shareCount} {shareCount === 1 ? 'time' : 'times'} this session — thank you!
            </Text>
          </View>
        ) : null}

        <View style={styles.benefitCard}>
          <Text style={styles.benefitTitle}>Why invite?</Text>
          <View style={styles.benefitRow}>
            <Ionicons name="rocket-outline" size={16} color={Theme.colors.passenger} />
            <Text style={styles.benefitText}>Help us add your trotro station to the live map</Text>
          </View>
          <View style={styles.benefitRow}>
            <Ionicons name="people-outline" size={16} color={Theme.colors.passenger} />
            <Text style={styles.benefitText}>More mates means more real-time seats for everyone</Text>
          </View>
          <View style={styles.benefitRow}>
            <Ionicons name="star-outline" size={16} color={Theme.colors.passenger} />
            <Text style={styles.benefitText}>Early invitees get loyalty perks at launch</Text>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Theme.colors.bgElevated },
  content: { flex: 1, padding: 20, paddingBottom: TAB_BAR_CLEARANCE },
  hero: { alignItems: 'center', marginBottom: 20 },
  heroIcon: {
    width: 84, height: 84, borderRadius: 26,
    backgroundColor: 'rgba(251,191,36,0.12)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(251,191,36,0.3)',
    marginBottom: 14,
  },
  title: { color: Theme.colors.text, fontSize: 22, fontWeight: '900', letterSpacing: -0.4 },
  subtitle: { color: Theme.colors.textSub, fontSize: 14, lineHeight: 22, textAlign: 'center', marginTop: 8 },
  codeCard: {
    backgroundColor: Theme.colors.surface,
    borderRadius: Theme.radius.lg, padding: 18,
    borderWidth: 1, borderColor: Theme.colors.border,
    alignItems: 'center', marginBottom: 16,
  },
  codeLabel: { color: Theme.colors.textMuted, fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  code: {
    color: Theme.colors.gold, fontSize: 26, fontWeight: '900',
    letterSpacing: 2, marginVertical: 8,
  },
  copyBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  copyText: { color: Theme.colors.passenger, fontSize: 13, fontWeight: '700' },
  primaryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: Theme.colors.passenger,
    borderRadius: 14, minHeight: 52, marginBottom: 10,
  },
  primaryText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  secondaryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderRadius: 14, minHeight: 48,
    borderWidth: 1, borderColor: Theme.colors.passenger + '55',
    marginBottom: 16,
  },
  secondaryText: { color: Theme.colors.passenger, fontSize: 15, fontWeight: '700' },
  shareNote: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Theme.colors.successSoft,
    borderRadius: 10, padding: 10, marginBottom: 12,
  },
  shareNoteText: { color: Theme.colors.success, fontSize: 12, fontWeight: '700', flex: 1 },
  benefitCard: {
    backgroundColor: Theme.colors.surface,
    borderRadius: Theme.radius.lg, padding: 16,
    borderWidth: 1, borderColor: Theme.colors.border,
  },
  benefitTitle: { color: Theme.colors.text, fontSize: 14, fontWeight: '800', marginBottom: 10 },
  benefitRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 6 },
  benefitText: { color: Theme.colors.textSub, fontSize: 13, flex: 1 },
});
