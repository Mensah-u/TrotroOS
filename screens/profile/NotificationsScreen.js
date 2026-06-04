import { Ionicons } from '@expo/vector-icons';
import { useCallback, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';

import ProfileHeader from '@/components/ProfileHeader';
import { TAB_BAR_CLEARANCE } from '@/constants/layout';
import { getPassengerProfile, savePassengerProfile } from '@/services/passengerProfile';
import { getOrCreateDeviceId } from '@/services/passengerProfile';
import { isPushAvailable, registerPushNotifications } from '@/services/notifications';

const C = {
  BG: '#121212', SURFACE: '#1E1E1E', BORDER: 'rgba(255,255,255,0.07)',
  ACCENT: '#F36F21', TEXT: '#FFFFFF', TEXT_SUB: '#E0E0E0', TEXT_MUTED: '#A8A8A8',
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
        trackColor={{ false: '#333', true: 'rgba(243,111,33,0.5)' }}
        thumbColor={value ? C.ACCENT : '#888'}
      />
    </View>
  );
}

export default function NotificationsScreen({ navigation }) {
  const [notifyTrips, setNotifyTrips] = useState(true);
  const [notifyReserve, setNotifyReserve] = useState(true);
  const [notifyPromo, setNotifyPromo] = useState(false);
  const [pushReady, setPushReady] = useState(false);

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

  const enablePush = async () => {
    const deviceId = await getOrCreateDeviceId();
    const res = await registerPushNotifications({ userId: deviceId, userRole: 'passenger' });
    if (res.ok) {
      setPushReady(true);
      Alert.alert('Push enabled', 'You will receive trip and reservation alerts.');
    } else {
      Alert.alert('Push unavailable', res.reason === 'denied' ? 'Enable notifications in Settings.' : 'Could not register push token.');
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ProfileHeader navigation={navigation} title="Notifications" />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.intro}>
          {isPushAvailable()
            ? 'Enable push for live trip alerts. Preferences sync to your passenger profile.'
            : 'Push requires a device build with expo-notifications installed.'}
        </Text>
        {isPushAvailable() ? (
          <ToggleRow
            icon="notifications-outline"
            label="Push notifications"
            sub={pushReady ? 'Registered on this device' : 'Tap to enable on this phone'}
            value={pushReady}
            onValueChange={(v) => { if (v) enablePush(); else setPushReady(false); }}
          />
        ) : null}
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
  card: { backgroundColor: C.SURFACE, borderRadius: 16, borderWidth: 1, borderColor: C.BORDER, overflow: 'hidden', marginTop: 12 },
  row: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 },
  rowIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#1E1E1E', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.BORDER },
  rowText: { flex: 1 },
  rowLabel: { color: C.TEXT, fontSize: 15, fontWeight: '600' },
  rowSub: { color: C.TEXT_MUTED, fontSize: 12, marginTop: 2 },
  divider: { height: 1, backgroundColor: C.BORDER, marginLeft: 64 },
});
