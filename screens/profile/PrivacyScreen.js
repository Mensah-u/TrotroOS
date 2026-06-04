import { Ionicons } from '@expo/vector-icons';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';

import ProfileHeader from '@/components/ProfileHeader';
import { TAB_BAR_CLEARANCE } from '@/constants/layout';
import { getPassengerProfile, savePassengerProfile } from '@/services/passengerProfile';

const C = {
  BG: '#121212', SURFACE: '#1E1E1E', BORDER: 'rgba(255,255,255,0.07)',
  ACCENT: '#F36F21', TEXT: '#FFFFFF', TEXT_SUB: '#E0E0E0', TEXT_MUTED: '#A8A8A8',
};

export default function PrivacyScreen({ navigation }) {
  const [shareLocation, setShareLocation] = useState(true);
  const [anonymousMode, setAnonymousMode] = useState(true);

  useFocusEffect(
    useCallback(() => {
      getPassengerProfile().then((p) => {
        setShareLocation(p.shareLocation);
        setAnonymousMode(p.anonymousMode);
      });
    }, []),
  );

  const onLocation = (v) => { setShareLocation(v); savePassengerProfile({ shareLocation: v }); };
  const onAnon = (v) => { setAnonymousMode(v); savePassengerProfile({ anonymousMode: v }); };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ProfileHeader navigation={navigation} title="Privacy" />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <View style={styles.row}>
            <View style={styles.rowIcon}><Ionicons name="location-outline" size={20} color={C.TEXT_SUB} /></View>
            <View style={styles.rowText}>
              <Text style={styles.rowLabel}>Share location</Text>
              <Text style={styles.rowSub}>Let mates see you on the map when waiting or reserved</Text>
            </View>
            <Switch value={shareLocation} onValueChange={onLocation} trackColor={{ false: '#333', true: 'rgba(243,111,33,0.5)' }} thumbColor={shareLocation ? C.ACCENT : '#888'} />
          </View>
          <View style={styles.divider} />
          <View style={styles.row}>
            <View style={styles.rowIcon}><Ionicons name="eye-off-outline" size={20} color={C.TEXT_SUB} /></View>
            <View style={styles.rowText}>
              <Text style={styles.rowLabel}>Anonymous rider</Text>
              <Text style={styles.rowSub}>No personal account — only a random device ID is stored</Text>
            </View>
            <Switch value={anonymousMode} onValueChange={onAnon} trackColor={{ false: '#333', true: 'rgba(243,111,33,0.5)' }} thumbColor={anonymousMode ? C.ACCENT : '#888'} />
          </View>
        </View>

        <View style={styles.infoCard}>
          <Ionicons name="shield-checkmark" size={22} color={C.ACCENT} />
          <Text style={styles.infoText}>
            TrotroOS only shares your GPS while you are actively waiting or have a reservation. You can stop sharing anytime by leaving the queue or cancelling.
          </Text>
        </View>

        <Pressable onPress={() => navigation.navigate('DataPrivacy')} style={styles.linkRow}>
          <Ionicons name="document-lock-outline" size={18} color={C.ACCENT} />
          <Text style={styles.linkText}>Data & privacy — export or delete</Text>
          <Ionicons name="chevron-forward" size={16} color={C.TEXT_MUTED} />
        </Pressable>

        <Pressable onPress={() => navigation.navigate('PrivacyPolicy')} style={styles.linkRow}>
          <Ionicons name="shield-outline" size={18} color={C.ACCENT} />
          <Text style={styles.linkText}>Privacy Policy</Text>
          <Ionicons name="chevron-forward" size={16} color={C.TEXT_MUTED} />
        </Pressable>

        <Text style={styles.footnote}>
          For terms of use, see Profile → Terms of Service.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.BG },
  content: { padding: 20, paddingBottom: TAB_BAR_CLEARANCE },
  card: { backgroundColor: C.SURFACE, borderRadius: 16, borderWidth: 1, borderColor: C.BORDER, overflow: 'hidden', marginBottom: 16 },
  row: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 },
  rowIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#1E1E1E', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.BORDER },
  rowText: { flex: 1 },
  rowLabel: { color: C.TEXT, fontSize: 15, fontWeight: '600' },
  rowSub: { color: C.TEXT_MUTED, fontSize: 12, marginTop: 2 },
  divider: { height: 1, backgroundColor: C.BORDER, marginLeft: 64 },
  infoCard: { flexDirection: 'row', gap: 12, backgroundColor: 'rgba(243,111,33,0.08)', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: 'rgba(243,111,33,0.25)' },
  infoText: { flex: 1, color: C.TEXT_SUB, fontSize: 13, lineHeight: 19 },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: 4,
    marginBottom: 4,
  },
  linkText: { flex: 1, color: C.TEXT, fontSize: 14, fontWeight: '700' },
  footnote: { color: C.TEXT_MUTED, fontSize: 12, lineHeight: 18, marginTop: 8 },
});
