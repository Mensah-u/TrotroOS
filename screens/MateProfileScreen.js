import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import {
  Alert,
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
import VehicleTypePicker from '@/components/VehicleTypePicker';
import { useAppSession } from '@/context/AppSessionContext';
import { TAB_BAR_CLEARANCE } from '@/constants/layout';
import { formatRoute, routes } from '@/constants/routes';
import { DEFAULT_VEHICLE_TYPE, normalizeVehicleType } from '@/constants/vehicleTypes';
import { Theme } from '@/constants/theme';
import {
  getCurrentMate,
  getMateProfile,
  upsertMateProfile,
} from '@/services/supabase';
import { formatSupabaseError } from '@/utils/supabaseErrors';

function findRouteIdByLabel(label) {
  if (!label) return null;
  const match = routes.find((r) => formatRoute(r) === label);
  return match ? match.id : null;
}

export default function MateProfileScreen({ navigation, route }) {
  const { switchRole } = useAppSession();
  const initialProfile = route?.params?.profile ?? null;
  const [profile, setProfile] = useState(initialProfile);
  const [loading, setLoading] = useState(!initialProfile);

  const [fullName, setFullName] = useState(initialProfile?.full_name ?? '');
  const [phoneNumber, setPhoneNumber] = useState(
    initialProfile?.phone_number ?? '',
  );
  const [vehicleRegistration, setVehicleRegistration] = useState(
    initialProfile?.vehicle_registration ?? '',
  );
  const [vehicleType, setVehicleType] = useState(
    normalizeVehicleType(initialProfile?.vehicle_type ?? DEFAULT_VEHICLE_TYPE),
  );
  const [defaultRouteId, setDefaultRouteId] = useState(
    findRouteIdByLabel(initialProfile?.default_route),
  );

  const [saving, setSaving] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  // If no profile passed via params, fetch fresh on mount.
  useEffect(() => {
    if (initialProfile) return;
    let mounted = true;
    (async () => {
      const { data: userData } = await getCurrentMate();
      if (!userData?.user) return;
      const { data } = await getMateProfile(userData.user.id);
      if (!mounted || !data) return;
      setProfile(data);
      setFullName(data.full_name ?? '');
      setPhoneNumber(data.phone_number ?? '');
      setVehicleRegistration(data.vehicle_registration ?? '');
      setVehicleType(normalizeVehicleType(data.vehicle_type ?? DEFAULT_VEHICLE_TYPE));
      setDefaultRouteId(findRouteIdByLabel(data.default_route));
      setLoading(false);
    })();
    return () => {
      mounted = false;
    };
  }, [initialProfile]);

  const handleSave = async () => {
    setErrorMsg(null);
    if (!fullName.trim() || !phoneNumber.trim() || !vehicleRegistration.trim()) {
      setErrorMsg('Name, phone, and vehicle registration are required.');
      return;
    }

    setSaving(true);
    try {
      const { data: userData } = await getCurrentMate();
      if (!userData?.user) {
        setErrorMsg('You are no longer signed in. Please log in again.');
        return;
      }
      const selectedRoute = routes.find((r) => r.id === defaultRouteId);
      const { error } = await upsertMateProfile(userData.user.id, {
        full_name: fullName.trim(),
        phone_number: phoneNumber.trim(),
        vehicle_registration: vehicleRegistration.trim().toUpperCase(),
        vehicle_type: vehicleType,
        default_route: selectedRoute ? formatRoute(selectedRoute) : null,
      });
      if (error) {
        setErrorMsg(formatSupabaseError(error.message));
        return;
      }
      Alert.alert('Saved', 'Profile updated.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (err) {
      setErrorMsg(err.message ?? 'Could not save profile.');
    } finally {
      setSaving(false);
    }
  };

  const handleSwitchToPassenger = () => {
    Alert.alert('Switch to Passenger?', 'You will sign out and open the passenger app.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Switch', onPress: () => switchRole() },
    ]);
  };

  const handleSignOut = () => {
    Alert.alert('Sign out?', 'You will return to role selection and need to sign in again.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          setSigningOut(true);
          try {
            await switchRole();
          } catch (err) {
            Alert.alert('Sign out failed', err.message ?? 'Try again.');
          } finally {
            setSigningOut(false);
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.headerRow}>
        <Pressable
          onPress={() => navigation.goBack()}
          hitSlop={12}
          style={styles.iconButton}
          accessibilityRole="button"
          accessibilityLabel="Back">
          <View style={styles.backBtn}>
            <Ionicons name="chevron-back" size={20} color="#FFFFFF" />
          </View>
        </Pressable>
        <Text style={styles.headerTitle}>Edit Profile</Text>
        <View style={styles.iconButton} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex1}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled">
          {loading ? (
            <Text style={styles.loadingText}>Loading profile…</Text>
          ) : null}

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
          <VehicleTypePicker value={vehicleType} onChange={setVehicleType} />

          <Text style={styles.sectionLabel}>Default Route</Text>
          <View style={styles.routeList}>
            {[{ id: null, label: 'None (any route)' }, ...routes.map((r) => ({ id: r.id, label: formatRoute(r) }))].map((item) => {
              const isSelected = item.id === defaultRouteId;
              return (
                <Pressable
                  key={String(item.id)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: isSelected }}
                  onPress={() => setDefaultRouteId(item.id)}
                  style={({ pressed }) => [styles.routeRow, isSelected && styles.routeRowSelected, pressed && styles.pressedOpacity]}>
                  <View style={[styles.routeRadio, isSelected && styles.routeRadioSelected]}>
                    {isSelected ? <View style={styles.routeRadioDot} /> : null}
                  </View>
                  <Text style={[styles.routeRowText, isSelected && styles.routeRowTextSelected]} numberOfLines={1}>
                    {item.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {errorMsg ? (
            <View style={styles.errorRow}>
              <Ionicons name="alert-circle-outline" size={15} color={Theme.colors.error} />
              <Text style={styles.error}>{errorMsg}</Text>
            </View>
          ) : null}

          <Pressable
            accessibilityRole="button"
            disabled={saving}
            onPress={handleSave}
            style={({ pressed }) => [
              styles.primaryButton,
              saving && styles.primaryButtonDisabled,
              pressed && !saving && styles.pressedOpacity,
            ]}>
            <Ionicons name="checkmark" size={20} color={saving ? '#E0E0E0' : '#FFFFFF'} />
            <Text style={styles.primaryButtonText}>
              {saving ? 'Saving…' : 'Save Changes'}
            </Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            onPress={handleSwitchToPassenger}
            style={({ pressed }) => [styles.switchButton, pressed && styles.pressedOpacity]}>
            <Ionicons name="swap-horizontal-outline" size={18} color="#F36F21" />
            <Text style={styles.switchText}>Switch to Passenger</Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            disabled={signingOut}
            onPress={handleSignOut}
            style={({ pressed }) => [
              styles.signOutButton,
              signingOut && styles.signOutButtonDisabled,
              pressed && !signingOut && styles.pressedOpacity,
            ]}>
            <Ionicons name="log-out-outline" size={18} color={Theme.colors.error} />
            <Text style={styles.signOutText}>
              {signingOut ? 'Signing out…' : 'Sign Out'}
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#121212' },
  flex1:    { flex: 1 },
  pressedOpacity: { opacity: 0.8 },

  headerRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.07)',
  },
  headerTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: '800' },
  iconButton:  { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  backBtn:     { width: 36, height: 36, borderRadius: 10, backgroundColor: '#1E1E1E', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)' },

  scrollContent: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: TAB_BAR_CLEARANCE },
  loadingText:   { color: '#E0E0E0', fontSize: 14, marginBottom: 12 },

  sectionLabel: {
    color: '#A8A8A8', fontSize: 11, fontWeight: '700',
    textTransform: 'uppercase', letterSpacing: 1,
    marginBottom: 10, marginTop: 24,
  },

  segmentRow: { flexDirection: 'row', gap: 10, marginBottom: 4 },
  segment: {
    flex: 1, minHeight: 52, borderRadius: 12,
    backgroundColor: '#1E1E1E', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
  },
  segmentSelected:     { borderColor: 'rgba(243,111,33,0.7)', backgroundColor: 'rgba(243,111,33,0.1)' },
  segmentText:         { color: '#E0E0E0', fontSize: 15, fontWeight: '600' },
  segmentTextSelected: { color: '#FFFFFF' },

  routeList: { gap: 8, marginBottom: 4 },
  routeRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#1E1E1E', borderRadius: 12,
    paddingHorizontal: 16, minHeight: 54, gap: 14,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
  },
  routeRowSelected:     { borderColor: 'rgba(243,111,33,0.6)', backgroundColor: 'rgba(243,111,33,0.07)' },
  routeRadio:           { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: '#A8A8A8', alignItems: 'center', justifyContent: 'center' },
  routeRadioSelected:   { borderColor: '#F36F21' },
  routeRadioDot:        { width: 10, height: 10, borderRadius: 5, backgroundColor: '#F36F21' },
  routeRowText:         { color: '#E0E0E0', fontSize: 15, fontWeight: '600', flex: 1 },
  routeRowTextSelected: { color: '#FFFFFF' },

  primaryButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: '#F36F21', borderRadius: 14, minHeight: 56,
    marginTop: 20, shadowColor: '#F36F21',
    shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 12,
  },
  primaryButtonDisabled: { backgroundColor: '#374151', shadowOpacity: 0 },
  primaryButtonText:     { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },

  switchButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    minHeight: 52, borderRadius: 14,
    borderWidth: 1, borderColor: 'rgba(243,111,33,0.4)',
    backgroundColor: 'rgba(243,111,33,0.08)', marginTop: 20,
  },
  switchText: { color: '#F36F21', fontSize: 15, fontWeight: '700' },

  signOutButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    minHeight: 52, borderRadius: 14,
    borderWidth: 1, borderColor: 'rgba(239,68,68,0.4)',
    backgroundColor: 'rgba(239,68,68,0.06)', marginTop: 16,
  },
  signOutButtonDisabled: { opacity: 0.5 },
  signOutText:   { color: Theme.colors.error, fontSize: 15, fontWeight: '700' },

  errorRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(239,68,68,0.08)', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10,
    borderWidth: 1, borderColor: 'rgba(239,68,68,0.2)', marginVertical: 8,
  },
  error: { color: Theme.colors.error, fontSize: 13, flex: 1 },
});
