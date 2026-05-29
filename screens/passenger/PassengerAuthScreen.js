import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FormInput } from '@/components/FormInput';
import PremiumBackground from '@/components/PremiumBackground';
import PremiumButton from '@/components/PremiumButton';
import TrotroLogo from '@/components/TrotroLogo';
import { SCREEN_SCROLL_BOTTOM } from '@/constants/layout';
import { Theme } from '@/constants/theme';
import { getPassengerProfile, savePassengerProfile } from '@/services/passengerProfile';

export default function PassengerAuthScreen({ onSuccess, onBack }) {
  const [displayName, setDisplayName] = useState('Passenger');
  const [phone, setPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  useEffect(() => {
    getPassengerProfile().then((profile) => {
      setDisplayName(profile.displayName);
      setPhone(profile.phone ?? '');
    }).catch(() => {});
  }, []);

  const handleContinue = async () => {
    setErrorMsg(null);
    if (!displayName.trim()) {
      setErrorMsg('Please enter your name.');
      return;
    }

    setSubmitting(true);
    try {
      const current = await getPassengerProfile();
      await savePassengerProfile({
        ...current,
        displayName: displayName.trim(),
        phone: phone.trim(),
      });
      onSuccess?.();
    } catch (err) {
      setErrorMsg(err.message ?? 'Could not continue. Try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <PremiumBackground variant="passenger">
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex1}>
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <Pressable onPress={onBack} hitSlop={12} style={styles.backBtn}>
              <Ionicons name="chevron-back" size={22} color={Theme.colors.text} />
              <Text style={styles.backText}>Choose role</Text>
            </Pressable>

            <TrotroLogo size="md" />
            <Text style={styles.heading}>Passenger access</Text>
            <Text style={styles.subheading}>
              Premium ride discovery — reserve seats and track your trotro live.
            </Text>

            <View style={styles.formCard}>
              <FormInput
                label="Display name"
                value={displayName}
                onChangeText={setDisplayName}
                placeholder="How mates see you"
                autoCapitalize="words"
                accentColor={Theme.colors.passenger}
              />
              <FormInput
                label="Phone (optional)"
                value={phone}
                onChangeText={setPhone}
                placeholder="+233..."
                keyboardType="phone-pad"
                accentColor={Theme.colors.passenger}
              />
            </View>

            {errorMsg ? (
              <View style={styles.errorRow}>
                <Ionicons name="alert-circle-outline" size={15} color={Theme.colors.danger} />
                <Text style={styles.error}>{errorMsg}</Text>
              </View>
            ) : null}

            <PremiumButton
              label="Continue as Passenger"
              variant="passenger"
              loading={submitting}
              onPress={handleContinue}
              icon={<Ionicons name="arrow-forward" size={20} color="#FFFFFF" />}
            />
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </PremiumBackground>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex1: { flex: 1 },
  content: { paddingHorizontal: 24, paddingBottom: SCREEN_SCROLL_BOTTOM },

  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 12, alignSelf: 'flex-start' },
  backText: { color: Theme.colors.textSub, fontSize: 15, fontWeight: '600' },

  heading: { color: Theme.colors.text, fontSize: 28, fontWeight: '900', letterSpacing: -0.5, marginTop: 20 },
  subheading: { color: Theme.colors.textSub, fontSize: 14, lineHeight: 21, marginTop: 8, marginBottom: 24 },

  formCard: {
    backgroundColor: Theme.colors.glass,
    borderRadius: Theme.radius.xl,
    padding: 18,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    marginBottom: 8,
  },

  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
    backgroundColor: 'rgba(239,68,68,0.08)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.2)',
  },
  error: { color: Theme.colors.danger, fontSize: 13, flex: 1 },
});
