import { Ionicons } from '@expo/vector-icons';
import { useCallback, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';

import ProfileHeader from '@/components/ProfileHeader';
import { TAB_BAR_CLEARANCE } from '@/constants/layout';
import { Theme } from '@/constants/theme';
import {
  EMERGENCY_NUMBERS,
  clearEmergencyContact,
  getEmergencyContact,
  saveEmergencyContact,
} from '@/services/emergencyContact';

export default function EmergencyContactScreen({ navigation }) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [relation, setRelation] = useState('');
  const [saving, setSaving] = useState(false);

  useFocusEffect(
    useCallback(() => {
      getEmergencyContact().then((c) => {
        setName(c.name);
        setPhone(c.phone);
        setRelation(c.relation);
      });
    }, []),
  );

  const save = async () => {
    if (!phone.trim()) {
      Alert.alert('Phone required', 'Enter a phone number so we can call your contact in an emergency.');
      return;
    }
    setSaving(true);
    try {
      await saveEmergencyContact({ name, phone, relation });
      Alert.alert('Saved', 'Emergency contact updated.');
    } finally {
      setSaving(false);
    }
  };

  const callContact = () => {
    if (!phone.trim()) return;
    Linking.openURL(`tel:${phone.trim()}`).catch(() => {});
  };

  const smsContact = () => {
    if (!phone.trim()) return;
    Linking.openURL(`sms:${phone.trim()}`).catch(() => {});
  };

  const clear = () => {
    Alert.alert('Remove emergency contact?', 'You can add a new one anytime.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          await clearEmergencyContact();
          setName('');
          setPhone('');
          setRelation('');
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ProfileHeader navigation={navigation} title="Emergency Contact" />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.banner}>
            <Ionicons name="shield-checkmark" size={26} color={Theme.colors.success} />
            <View style={{ flex: 1 }}>
              <Text style={styles.bannerTitle}>Stay safer on every trip</Text>
              <Text style={styles.bannerSub}>
                Save a trusted contact. You can reach them in one tap from the safety menu during a ride.
              </Text>
            </View>
          </View>

          <Text style={styles.sectionLabel}>TRUSTED CONTACT</Text>
          <View style={styles.card}>
            <Text style={styles.label}>Full name</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="e.g. Kwame Mensah"
              placeholderTextColor={Theme.colors.textMuted}
              autoCapitalize="words"
            />
            <Text style={styles.label}>Phone number</Text>
            <TextInput
              style={styles.input}
              value={phone}
              onChangeText={setPhone}
              placeholder="0244 123 456"
              placeholderTextColor={Theme.colors.textMuted}
              keyboardType="phone-pad"
            />
            <Text style={styles.label}>Relationship</Text>
            <TextInput
              style={styles.input}
              value={relation}
              onChangeText={setRelation}
              placeholder="Friend, parent, partner…"
              placeholderTextColor={Theme.colors.textMuted}
            />

            <View style={styles.actionRow}>
              <Pressable onPress={save} disabled={saving} style={({ pressed }) => [styles.btnPrimary, pressed && { opacity: 0.85 }, saving && { opacity: 0.6 }]}>
                <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                <Text style={styles.btnPrimaryText}>{saving ? 'Saving…' : 'Save contact'}</Text>
              </Pressable>
              {phone ? (
                <Pressable onPress={callContact} style={({ pressed }) => [styles.btnGhost, pressed && { opacity: 0.7 }]}>
                  <Ionicons name="call-outline" size={16} color={Theme.colors.passenger} />
                  <Text style={styles.btnGhostText}>Call</Text>
                </Pressable>
              ) : null}
              {phone ? (
                <Pressable onPress={smsContact} style={({ pressed }) => [styles.btnGhost, pressed && { opacity: 0.7 }]}>
                  <Ionicons name="chatbubble-outline" size={16} color={Theme.colors.passenger} />
                  <Text style={styles.btnGhostText}>SMS</Text>
                </Pressable>
              ) : null}
            </View>

            {phone ? (
              <Pressable onPress={clear} style={({ pressed }) => [styles.clearBtn, pressed && { opacity: 0.7 }]}>
                <Ionicons name="trash-outline" size={14} color={Theme.colors.danger} />
                <Text style={styles.clearText}>Remove contact</Text>
              </Pressable>
            ) : null}
          </View>

          <Text style={styles.sectionLabel}>GHANA EMERGENCY LINES</Text>
          <View style={styles.card}>
            {EMERGENCY_NUMBERS.map((line, idx) => (
              <View key={line.number}>
                <Pressable
                  onPress={() => Linking.openURL(`tel:${line.number}`).catch(() => {})}
                  style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}>
                  <View style={styles.lineIcon}>
                    <Ionicons name={line.icon} size={18} color={Theme.colors.danger} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.lineLabel}>{line.label}</Text>
                    <Text style={styles.lineSub}>Tap to call · {line.number}</Text>
                  </View>
                  <Ionicons name="call" size={18} color={Theme.colors.danger} />
                </Pressable>
                {idx < EMERGENCY_NUMBERS.length - 1 ? <View style={styles.divider} /> : null}
              </View>
            ))}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Theme.colors.bgElevated },
  content: { padding: 20, paddingBottom: TAB_BAR_CLEARANCE },
  banner: {
    flexDirection: 'row', gap: 12,
    backgroundColor: Theme.colors.successSoft,
    borderRadius: Theme.radius.lg, padding: 16,
    borderWidth: 1, borderColor: 'rgba(34,197,94,0.25)',
    marginBottom: 18,
  },
  bannerTitle: { color: Theme.colors.text, fontSize: 15, fontWeight: '800' },
  bannerSub: { color: Theme.colors.textSub, fontSize: 13, marginTop: 4, lineHeight: 18 },
  sectionLabel: { color: Theme.colors.textMuted, fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 10 },
  card: {
    backgroundColor: Theme.colors.surface,
    borderRadius: Theme.radius.lg, padding: 14,
    borderWidth: 1, borderColor: Theme.colors.border,
    marginBottom: 16,
  },
  label: { color: Theme.colors.textMuted, fontSize: 11, fontWeight: '700', letterSpacing: 0.6, marginTop: 8, marginBottom: 6 },
  input: {
    backgroundColor: Theme.colors.surfaceUp,
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10,
    color: Theme.colors.text, fontSize: 14,
    borderWidth: 1, borderColor: Theme.colors.border,
  },
  actionRow: { flexDirection: 'row', gap: 8, marginTop: 14, flexWrap: 'wrap' },
  btnPrimary: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Theme.colors.passenger,
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10,
  },
  btnPrimaryText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  btnGhost: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10,
    borderWidth: 1, borderColor: Theme.colors.passenger + '55',
  },
  btnGhostText: { color: Theme.colors.passenger, fontSize: 14, fontWeight: '700' },
  clearBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 12, alignSelf: 'flex-start' },
  clearText: { color: Theme.colors.danger, fontSize: 12, fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  lineIcon: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: 'rgba(239,68,68,0.1)',
    alignItems: 'center', justifyContent: 'center',
  },
  lineLabel: { color: Theme.colors.text, fontSize: 14, fontWeight: '700' },
  lineSub: { color: Theme.colors.textMuted, fontSize: 12, marginTop: 2 },
  divider: { height: 1, backgroundColor: Theme.colors.border, marginLeft: 60 },
});
