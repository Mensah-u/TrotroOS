import { Ionicons } from '@expo/vector-icons';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';

import ProfileHeader from '@/components/ProfileHeader';
import { TAB_BAR_CLEARANCE } from '@/constants/layout';
import { getPassengerProfile, savePassengerProfile } from '@/services/passengerProfile';

const C = {
  BG: '#0C0C0C', SURFACE: '#161616', BORDER: 'rgba(255,255,255,0.07)',
  ACCENT: '#F97316', TEXT: '#F9FAFB', TEXT_SUB: '#9CA3AF', TEXT_MUTED: '#4B5563',
};

function ToggleRow({ icon, label, sub, value, onValueChange }) {
  return (
    <View style={styles.row}>
      <View style={styles.rowIcon}><Ionicons name={icon} size={20} color={C.TEXT_SUB} /></View>
      <View style={styles.rowText}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={styles.rowSub}>{sub}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: '#333', true: 'rgba(249,115,22,0.5)' }}
        thumbColor={value ? C.ACCENT : '#888'}
      />
    </View>
  );
}

export default function NotificationsScreen({ navigation }) {
  const [notifyTrips, setNotifyTrips] = useState(true);
  const [notifyReserve, setNotifyReserve] = useState(true);
  const [notifyPromo, setNotifyPromo] = useState(false);

  useFocusEffect(
    useCallback(() => {
      getPassengerProfile().then((p) => {
        setNotifyTrips(p.notifyTrips);
        setNotifyReserve(p.notifyReserve);
        setNotifyPromo(p.notifyPromo);
      });
    }, []),
  );

  const setTrips = (v) => { setNotifyTrips(v); savePassengerProfile({ notifyTrips: v }); };
  const setReserve = (v) => { setNotifyReserve(v); savePassengerProfile({ notifyReserve: v }); };
  const setPromo = (v) => { setNotifyPromo(v); savePassengerProfile({ notifyPromo: v }); };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ProfileHeader navigation={navigation} title="Notifications" />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.intro}>Choose what TrotroOS can notify you about. Push notifications coming in a future update — preferences are saved on this device.</Text>
        <View style={styles.card}>
          <ToggleRow icon="bus-outline" label="Trip updates" sub="When seat counts change on your route" value={notifyTrips} onValueChange={setTrips} />
          <View style={styles.divider} />
          <ToggleRow icon="ticket-outline" label="Reservation alerts" sub="Confirmations and expiry reminders" value={notifyReserve} onValueChange={setReserve} />
          <View style={styles.divider} />
          <ToggleRow icon="megaphone-outline" label="Promotions" sub="New routes and TrotroOS news" value={notifyPromo} onValueChange={setPromo} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.BG },
  content: { padding: 20, paddingBottom: TAB_BAR_CLEARANCE },
  intro: { color: C.TEXT_SUB, fontSize: 14, lineHeight: 20, marginBottom: 16 },
  card: { backgroundColor: C.SURFACE, borderRadius: 16, borderWidth: 1, borderColor: C.BORDER, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 },
  rowIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#1E1E1E', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.BORDER },
  rowText: { flex: 1 },
  rowLabel: { color: C.TEXT, fontSize: 15, fontWeight: '600' },
  rowSub: { color: C.TEXT_MUTED, fontSize: 12, marginTop: 2 },
  divider: { height: 1, backgroundColor: C.BORDER, marginLeft: 64 },
});
