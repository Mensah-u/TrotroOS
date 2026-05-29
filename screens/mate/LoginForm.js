import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
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
import TrotroLogo from '@/components/TrotroLogo';
import { SCREEN_SCROLL_BOTTOM } from '@/constants/layout';
import { Theme } from '@/constants/theme';
import { signInMate } from '@/services/supabase';
import { isEmailNotConfirmedError } from '@/services/authDeepLink';

const C = {
  BG:         '#0C0C0C',
  SURFACE:    '#161616',
  SURFACE_UP: '#1E1E1E',
  BORDER:     'rgba(255,255,255,0.07)',
  ACCENT:     Theme.colors.mate,
  TEXT:       '#F9FAFB',
  TEXT_SUB:   '#9CA3AF',
  TEXT_MUTED: '#4B5563',
  DANGER:     '#EF4444',
};

export default function LoginForm({ onSuccess, onSwitchToSignUp, onBack }) {
  const [email,      setEmail]      = useState('');
  const [password,   setPassword]   = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg,   setErrorMsg]   = useState(null);
  const [showPass,   setShowPass]   = useState(false);

  const handleLogin = async () => {
    setErrorMsg(null);
    if (!email.trim() || !password) {
      setErrorMsg('Email and password are required.');
      return;
    }
    setSubmitting(true);
    try {
      const { data, error } = await signInMate(email.trim(), password);
      if (error) {
        if (isEmailNotConfirmedError(error)) {
          setErrorMsg(
            'Confirm your email first — open the link we sent you. After confirming, tap Log In again (no need to restart the app).',
          );
        } else {
          setErrorMsg(error.message);
        }
        return;
      }
      if (!data?.session) {
        setErrorMsg('Sign-in failed — confirm your email, then try again.');
        return;
      }
      onSuccess?.();
    } catch (err) {
      setErrorMsg(err.message ?? 'Unable to sign in. Try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <PremiumBackground variant="mate">
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex1}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">

          {onBack ? (
            <Pressable onPress={onBack} hitSlop={12} style={styles.backBtn}>
              <Ionicons name="chevron-back" size={22} color={C.TEXT} />
              <Text style={styles.backText}>Choose role</Text>
            </Pressable>
          ) : null}

          <TrotroLogo size="md" />

          <Text style={styles.heading}>Mate sign in</Text>
          <Text style={styles.subheading}>Sign in to start trips, go live on the map, and earn with TrotroOS.</Text>

          <View style={styles.form}>
            <FormInput
              label="Email"
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              textContentType="emailAddress"
            />
            <View style={styles.passRow}>
              <View style={styles.passField}>
                <FormInput
                  label="Password"
                  value={password}
                  onChangeText={setPassword}
                  placeholder="••••••••"
                  secureTextEntry={!showPass}
                  autoCapitalize="none"
                  autoCorrect={false}
                  textContentType="password"
                />
              </View>
              <Pressable onPress={() => setShowPass((s) => !s)} style={styles.passToggle} hitSlop={8}>
                <Ionicons name={showPass ? 'eye-off-outline' : 'eye-outline'} size={20} color={C.TEXT_MUTED} />
              </Pressable>
            </View>
          </View>

          {errorMsg ? (
            <View style={styles.errorRow}>
              <Ionicons name="alert-circle-outline" size={15} color={C.DANGER} />
              <Text style={styles.error}>{errorMsg}</Text>
            </View>
          ) : null}

          <Pressable
            accessibilityRole="button"
            disabled={submitting}
            onPress={handleLogin}
            style={({ pressed }) => [styles.primaryButton, submitting && styles.primaryButtonDisabled, pressed && !submitting && { opacity: 0.85 }]}>
            {submitting ? (
              <Text style={styles.primaryButtonText}>Signing in…</Text>
            ) : (
              <>
                <Ionicons name="log-in-outline" size={20} color="#FFFFFF" />
                <Text style={styles.primaryButtonText}>Log In</Text>
              </>
            )}
          </Pressable>

          <Pressable accessibilityRole="link" onPress={onSwitchToSignUp} style={styles.switchLink} hitSlop={8}>
            <Text style={styles.switchLinkText}>
              New mate?{' '}
              <Text style={styles.switchLinkAccent}>Create an account →</Text>
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
    </PremiumBackground>
  );
}

const styles = StyleSheet.create({
  safeArea:     { flex: 1, backgroundColor: 'transparent' },
  flex1:        { flex: 1 },
  scrollContent:{ paddingHorizontal: 24, paddingTop: 32, paddingBottom: SCREEN_SCROLL_BOTTOM },

  backBtn:   { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 16, alignSelf: 'flex-start' },
  backText:  { color: C.TEXT_SUB, fontSize: 15, fontWeight: '600' },

  logoRow:  { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 36 },
  logoIcon: { width: 46, height: 46, borderRadius: 14, backgroundColor: 'rgba(249,115,22,0.12)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(249,115,22,0.3)' },
  logoText: { color: C.TEXT, fontSize: 22, fontWeight: '800', letterSpacing: -0.4 },

  heading:    { color: C.TEXT, fontSize: 30, fontWeight: '800', letterSpacing: -0.5, marginBottom: 8 },
  subheading: { color: C.TEXT_MUTED, fontSize: 14, lineHeight: 20, marginBottom: 32 },

  form:      { gap: 4, marginBottom: 4 },
  passRow:   { position: 'relative' },
  passField: { flex: 1 },
  passToggle:{ position: 'absolute', right: 16, bottom: 14 },

  errorRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16, backgroundColor: 'rgba(239,68,68,0.08)', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderColor: 'rgba(239,68,68,0.2)' },
  error:    { color: C.DANGER, fontSize: 13, flex: 1 },

  primaryButton:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: C.ACCENT, borderRadius: 14, minHeight: 56, marginBottom: 20, shadowColor: C.ACCENT, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 12 },
  primaryButtonDisabled: { backgroundColor: C.TEXT_MUTED, shadowOpacity: 0 },
  primaryButtonText:     { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },

  switchLink:       { alignItems: 'center', paddingVertical: 8 },
  switchLinkText:   { color: C.TEXT_MUTED, fontSize: 14 },
  switchLinkAccent: { color: C.ACCENT, fontWeight: '700' },
});
