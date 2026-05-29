import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import ProfileHeader from '@/components/ProfileHeader';
import PremiumButton from '@/components/PremiumButton';
import { TAB_BAR_CLEARANCE } from '@/constants/layout';
import { Theme } from '@/constants/theme';
import { useI18n } from '@/context/I18nContext';
import { submitSafetyReport } from '@/services/featuresV14';
import { getOrCreateDeviceId } from '@/services/passengerProfile';
import { getCurrentMate } from '@/services/supabase';
import { getEmergencyContact } from '@/services/emergencyContact';
import { Linking } from 'react-native';

const CATEGORIES = [
  { id: 'fare_dispute', label: 'Fare dispute', icon: 'cash-outline' },
  { id: 'safety', label: 'Safety concern', icon: 'shield-outline' },
  { id: 'harassment', label: 'Harassment', icon: 'alert-circle-outline' },
  { id: 'wrong_route', label: 'Wrong route / drop-off', icon: 'map-outline' },
  { id: 'other', label: 'Other', icon: 'ellipsis-horizontal' },
];

export default function SafetyReportScreen({ navigation, route }) {
  const { t } = useI18n();
  const [category, setCategory] = useState('safety');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const tripId = route.params?.tripId ?? null;
  const reservationId = route.params?.reservationId ?? null;

  const callEmergency = async () => {
    const contact = await getEmergencyContact().catch(() => null);
    if (contact?.phone) {
      Linking.openURL(`tel:${contact.phone}`);
      return;
    }
    Alert.alert('Emergency', 'Call 112 or 191 for immediate help.');
    Linking.openURL('tel:112');
  };

  const submit = async () => {
    if (description.trim().length < 10) {
      Alert.alert('More detail needed', 'Describe what happened in at least a few words.');
      return;
    }
    setSubmitting(true);
    try {
      const mate = await getCurrentMate().catch(() => null);
      const deviceId = await getOrCreateDeviceId();
      const reporterRole = mate?.id ? 'mate' : 'passenger';
      const reporterId = mate?.id ?? deviceId;
      const { error } = await submitSafetyReport({
        reporterId,
        reporterRole,
        tripId,
        reservationId,
        category,
        description: description.trim(),
      });
      if (error) throw error;
      Alert.alert('Report submitted', 'Our team will review this. For emergencies, call 112.');
      navigation.goBack();
    } catch (e) {
      Alert.alert('Could not submit', e.message ?? 'Run supabase/FIX_v14_features.sql first.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ProfileHeader navigation={navigation} title={t('reportIssue')} />
      <ScrollView contentContainerStyle={styles.content}>
        <Pressable onPress={callEmergency} style={styles.emergencyBtn}>
          <Ionicons name="call" size={18} color="#fff" />
          <Text style={styles.emergencyText}>Emergency call</Text>
        </Pressable>

        <Text style={styles.intro}>
          Report fare disputes, safety issues, or problems with a trip. Include as much detail as you can.
        </Text>

        <Text style={styles.label}>Category</Text>
        <View style={styles.categories}>
          {CATEGORIES.map((c) => (
            <Pressable
              key={c.id}
              onPress={() => setCategory(c.id)}
              style={[styles.cat, category === c.id && styles.catActive]}>
              <Ionicons
                name={c.icon}
                size={16}
                color={category === c.id ? Theme.colors.passenger : Theme.colors.textSub}
              />
              <Text style={[styles.catText, category === c.id && styles.catTextActive]}>{c.label}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.label}>What happened?</Text>
        <TextInput
          value={description}
          onChangeText={setDescription}
          multiline
          placeholder="Describe the issue…"
          placeholderTextColor={Theme.colors.textMuted}
          style={styles.textarea}
        />

        <PremiumButton
          label="Submit report"
          variant="passenger"
          loading={submitting}
          onPress={submit}
          icon={<Ionicons name="send-outline" size={18} color="#fff" />}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Theme.colors.bgElevated },
  content: { padding: 20, paddingBottom: TAB_BAR_CLEARANCE },
  emergencyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Theme.colors.danger,
    borderRadius: 12,
    paddingVertical: 14,
    marginBottom: 16,
  },
  emergencyText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  intro: { color: Theme.colors.textSub, fontSize: 14, lineHeight: 20, marginBottom: 16 },
  label: { color: Theme.colors.textMuted, fontSize: 12, fontWeight: '700', marginBottom: 8 },
  categories: { gap: 8, marginBottom: 16 },
  cat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 12,
    backgroundColor: Theme.colors.surface,
    borderWidth: 1,
    borderColor: Theme.colors.border,
  },
  catActive: { borderColor: Theme.colors.passenger, backgroundColor: Theme.colors.passengerSoft },
  catText: { color: Theme.colors.textSub, fontWeight: '600' },
  catTextActive: { color: Theme.colors.text },
  textarea: {
    minHeight: 120,
    textAlignVertical: 'top',
    backgroundColor: Theme.colors.surface,
    borderRadius: 12,
    padding: 12,
    color: Theme.colors.text,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    marginBottom: 16,
  },
});
