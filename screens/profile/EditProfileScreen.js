import { Ionicons } from '@expo/vector-icons';
import { useCallback, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';

import { FormInput } from '@/components/FormInput';
import { TAB_BAR_CLEARANCE } from '@/constants/layout';
import ProfileHeader from '@/components/ProfileHeader';
import { getPassengerProfile, savePassengerProfile } from '@/services/passengerProfile';

const C = {
  BG: '#0C0C0C', SURFACE: '#161616', BORDER: 'rgba(255,255,255,0.07)',
  ACCENT: '#F97316', TEXT: '#F9FAFB', TEXT_SUB: '#9CA3AF', TEXT_MUTED: '#4B5563',
};

export default function EditProfileScreen({ navigation }) {
  const [displayName, setDisplayName] = useState('Passenger');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);

  useFocusEffect(
    useCallback(() => {
      getPassengerProfile().then((p) => {
        setDisplayName(p.displayName);
        setPhone(p.phone);
      });
    }, []),
  );

  const handleSave = async () => {
    if (!displayName.trim()) {
      Alert.alert('Name required', 'Please enter a display name.');
      return;
    }
    setSaving(true);
    try {
      await savePassengerProfile({ displayName, phone });
      Alert.alert('Saved', 'Your profile has been updated.');
      navigation.goBack();
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ProfileHeader navigation={navigation} title="Edit Profile" />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.avatarBlock}>
            <View style={styles.avatar}>
              <Ionicons name="person" size={32} color={C.TEXT_MUTED} />
            </View>
            <Text style={styles.avatarHint}>Passenger account (no login required)</Text>
          </View>

          <FormInput label="Display name" value={displayName} onChangeText={setDisplayName} placeholder="How mates see you" autoCapitalize="words" />
          <FormInput label="Phone (optional)" value={phone} onChangeText={setPhone} placeholder="+233..." keyboardType="phone-pad" />

          <Pressable
            onPress={handleSave}
            disabled={saving}
            style={({ pressed }) => [styles.saveBtn, saving && { opacity: 0.6 }, pressed && { opacity: 0.85 }]}>
            <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
            <Text style={styles.saveText}>{saving ? 'Saving…' : 'Save Profile'}</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.BG },
  content: { padding: 20, paddingBottom: TAB_BAR_CLEARANCE, gap: 4 },
  avatarBlock: { alignItems: 'center', marginBottom: 20 },
  avatar: { width: 72, height: 72, borderRadius: 22, backgroundColor: C.SURFACE, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.BORDER, marginBottom: 8 },
  avatarHint: { color: C.TEXT_MUTED, fontSize: 12 },
  saveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', alignSelf: 'stretch', gap: 8, backgroundColor: C.ACCENT, borderRadius: 14, minHeight: 56, marginTop: 20 },
  saveText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
});
