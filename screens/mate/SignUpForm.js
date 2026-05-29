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
import { SCREEN_SCROLL_BOTTOM } from '@/constants/layout';
import { formatRoute, routes } from '@/constants/routes';
import { signInMate, signUpMate, upsertMateProfile } from '@/services/supabase';
import { formatSupabaseError } from '@/utils/supabaseErrors';

const VEHICLE_TYPES = ['Trotro', 'Bus'];

export default function SignUpForm({ onSuccess, onSwitchToLogin, onBack }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [vehicleRegistration, setVehicleRegistration] = useState('');
  const [vehicleType, setVehicleType] = useState('Trotro');
  const [defaultRouteId, setDefaultRouteId] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  const validate = () => {
    if (!email.trim()) return 'Email is required.';
    if (!password || password.length < 6)
      return 'Password must be at least 6 characters.';
    if (!fullName.trim()) return 'Full name is required.';
    if (!phoneNumber.trim()) return 'Phone number is required.';
    if (!vehicleRegistration.trim())
      return 'Vehicle registration is required.';
    return null;
  };

  const handleSignUp = async () => {
    setErrorMsg(null);
    const validationError = validate();
    if (validationError) {
      setErrorMsg(validationError);
      return;
    }

    setSubmitting(true);
    try {
      const { data: signUpData, error: signUpError } = await signUpMate(
        email.trim(),
        password,
      );
      if (signUpError) {
        setErrorMsg(signUpError.message);
        return;
      }

      // If email confirmation is required, signUp returns no session.
      // Try to sign in immediately — Supabase will reject if confirmation needed.
      let userId = signUpData?.user?.id;
      let session = signUpData?.session;

      if (!session) {
        const { data: signInData, error: signInError } = await signInMate(
          email.trim(),
          password,
        );
        if (!signInError) {
          userId = signInData?.user?.id ?? userId;
          session = signInData?.session;
        }
      }

      if (!userId) {
        setErrorMsg('Account created but could not retrieve user. Try logging in.');
        return;
      }

      const selectedRoute = routes.find((r) => r.id === defaultRouteId);
      const { error: profileError } = await upsertMateProfile(userId, {
        full_name: fullName.trim(),
        phone_number: phoneNumber.trim(),
        vehicle_registration: vehicleRegistration.trim().toUpperCase(),
        vehicle_type: vehicleType,
        default_route: selectedRoute ? formatRoute(selectedRoute) : null,
      });

      if (profileError) {
        setErrorMsg(formatSupabaseError(profileError.message));
        return;
      }

      if (!session) {
        setErrorMsg(
          'Account created! Open the confirmation link in your email, then tap Log In here (no need to restart the app).',
        );
        return;
      }

      onSuccess?.();
    } catch (err) {
      setErrorMsg(err.message ?? 'Unable to sign up. Try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex1}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled">
          {onBack ? (
            <Pressable onPress={onBack} hitSlop={12} style={styles.backBtn}>
              <Ionicons name="chevron-back" size={22} color="#F9FAFB" />
              <Text style={styles.backText}>Choose role</Text>
            </Pressable>
          ) : null}
          <Text style={styles.heading}>Sign Up as a Mate</Text>
          <Text style={styles.subheading}>
            We'll use this info to verify your trips.
          </Text>

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
          <FormInput
            label="Password"
            value={password}
            onChangeText={setPassword}
            placeholder="At least 6 characters"
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            textContentType="newPassword"
          />
          <FormInput
            label="Full Name"
            value={fullName}
            onChangeText={setFullName}
            placeholder="Kwame Mensah"
            autoCapitalize="words"
            textContentType="name"
          />
          <FormInput
            label="Phone Number"
            value={phoneNumber}
            onChangeText={setPhoneNumber}
            placeholder="0244 123 456"
            keyboardType="phone-pad"
            textContentType="telephoneNumber"
          />
          <FormInput
            label="Vehicle Registration"
            value={vehicleRegistration}
            onChangeText={setVehicleRegistration}
            placeholder="GW 1234-20"
            autoCapitalize="characters"
            autoCorrect={false}
          />

          <Text style={styles.sectionLabel}>Vehicle Type</Text>
          <View style={styles.segmentRow}>
            {VEHICLE_TYPES.map((type) => {
              const isSelected = vehicleType === type;
              return (
                <Pressable
                  key={type}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: isSelected }}
                  onPress={() => setVehicleType(type)}
                  style={({ pressed }) => [
                    styles.segment,
                    isSelected && styles.segmentSelected,
                    pressed && styles.pressedOpacity,
                  ]}>
                  <Text
                    style={[
                      styles.segmentText,
                      isSelected && styles.segmentTextSelected,
                    ]}>
                    {type}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={styles.sectionLabel}>Default Route (optional)</Text>
          <View style={styles.routeList}>
            <Pressable
              accessibilityRole="radio"
              accessibilityState={{ selected: defaultRouteId === null }}
              onPress={() => setDefaultRouteId(null)}
              style={({ pressed }) => [
                styles.routeRow,
                defaultRouteId === null && styles.routeRowSelected,
                pressed && styles.pressedOpacity,
              ]}>
              <Text
                style={[
                  styles.routeRowText,
                  defaultRouteId === null && styles.routeRowTextSelected,
                ]}>
                None
              </Text>
            </Pressable>
            {routes.map((route) => {
              const isSelected = route.id === defaultRouteId;
              return (
                <Pressable
                  key={route.id}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: isSelected }}
                  onPress={() => setDefaultRouteId(route.id)}
                  style={({ pressed }) => [
                    styles.routeRow,
                    isSelected && styles.routeRowSelected,
                    pressed && styles.pressedOpacity,
                  ]}>
                  <Text
                    style={[
                      styles.routeRowText,
                      isSelected && styles.routeRowTextSelected,
                    ]}>
                    {formatRoute(route)}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {errorMsg ? <Text style={styles.error}>{errorMsg}</Text> : null}

          <Pressable
            accessibilityRole="button"
            disabled={submitting}
            onPress={handleSignUp}
            style={({ pressed }) => [
              styles.primaryButton,
              submitting && styles.primaryButtonDisabled,
              pressed && !submitting && styles.pressedOpacity,
            ]}>
            <Text style={styles.primaryButtonText}>
              {submitting ? 'Creating account…' : 'Create Account'}
            </Text>
          </Pressable>

          <Pressable
            accessibilityRole="link"
            onPress={onSwitchToLogin}
            style={styles.switchLink}
            hitSlop={8}>
            <Text style={styles.switchLinkText}>
              Already have an account?{' '}
              <Text style={styles.switchLinkTextAccent}>Log In</Text>
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#1A1A1A',
  },
  flex1: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: SCREEN_SCROLL_BOTTOM,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 12,
    alignSelf: 'flex-start',
  },
  backText: { color: '#9CA3AF', fontSize: 15, fontWeight: '600' },
  heading: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '800',
  },
  subheading: {
    color: '#9CA3AF',
    fontSize: 14,
    marginTop: 6,
    marginBottom: 20,
  },
  sectionLabel: {
    color: '#9CA3AF',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
    marginTop: 4,
  },
  segmentRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  segment: {
    flex: 1,
    minHeight: 50,
    borderRadius: 8,
    backgroundColor: '#2A2A2A',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  segmentSelected: {
    borderColor: '#E67E22',
    backgroundColor: '#3A2A1A',
  },
  segmentText: {
    color: '#E5E7EB',
    fontSize: 15,
    fontWeight: '600',
  },
  segmentTextSelected: {
    color: '#FFFFFF',
  },
  routeList: {
    gap: 8,
    marginBottom: 16,
  },
  routeRow: {
    backgroundColor: '#2A2A2A',
    borderRadius: 8,
    paddingHorizontal: 16,
    minHeight: 50,
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  routeRowSelected: {
    borderColor: '#E67E22',
    backgroundColor: '#3A2A1A',
  },
  routeRowText: {
    color: '#E5E7EB',
    fontSize: 15,
    fontWeight: '600',
  },
  routeRowTextSelected: {
    color: '#FFFFFF',
  },
  primaryButton: {
    backgroundColor: '#E67E22',
    borderRadius: 8,
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  primaryButtonDisabled: {
    backgroundColor: '#4B5563',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  pressedOpacity: {
    opacity: 0.85,
  },
  switchLink: {
    alignItems: 'center',
    marginTop: 16,
    paddingVertical: 8,
  },
  switchLinkText: {
    color: '#9CA3AF',
    fontSize: 14,
  },
  switchLinkTextAccent: {
    color: '#E67E22',
    fontWeight: '700',
  },
  error: {
    color: '#F87171',
    fontSize: 14,
    marginVertical: 8,
  },
});
