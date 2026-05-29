import { Ionicons } from '@expo/vector-icons';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';

import ProfileHeader from '@/components/ProfileHeader';
import { TAB_BAR_CLEARANCE } from '@/constants/layout';
import { Theme } from '@/constants/theme';
import { getMateSettings, saveMateSettings } from '@/services/mateSettings';

function ToggleRow({ icon, label, sub, value, onValueChange }) {
  return (
    <View style={styles.row}>
      <View style={styles.rowIcon}>
        <Ionicons name={icon} size={20} color={Theme.colors.textSub} />
      </View>
      <View style={styles.rowText}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={styles.rowSub}>{sub}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: '#333', true: 'rgba(243,111,33,0.5)' }}
        thumbColor={value ? Theme.colors.mate : '#888'}
      />
    </View>
  );
}

export default function MateNotificationsScreen({ navigation }) {
  const [notifyTrips, setNotifyTrips] = useState(true);
  const [notifyReserve, setNotifyReserve] = useState(true);
  const [notifyEarn, setNotifyEarn] = useState(true);

  useFocusEffect(
    useCallback(() => {
      getMateSettings().then((s) => {
        setNotifyTrips(s.notifyTrips);
        setNotifyReserve(s.notifyReserve);
        setNotifyEarn(s.notifyEarn);
      });
    }, []),
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ProfileHeader navigation={navigation} title="Notifications" />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.intro}>
          Control alerts for your dashboard. Push notifications will use these preferences in a future update.
        </Text>
        <View style={styles.card}>
          <ToggleRow
            icon="bus-outline"
            label="Trip status"
            sub="When a trip is marked full or ended"
            value={notifyTrips}
            onValueChange={(v) => { setNotifyTrips(v); saveMateSettings({ notifyTrips: v }); }}
          />
          <View style={styles.divider} />
          <ToggleRow
            icon="person-add-outline"
            label="New reservations"
            sub="When a passenger reserves a seat"
            value={notifyReserve}
            onValueChange={(v) => { setNotifyReserve(v); saveMateSettings({ notifyReserve: v }); }}
          />
          <View style={styles.divider} />
          <ToggleRow
            icon="wallet-outline"
            label="Earnings summary"
            sub="Weekly trip and demand highlights"
            value={notifyEarn}
            onValueChange={(v) => { setNotifyEarn(v); saveMateSettings({ notifyEarn: v }); }}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Theme.colors.bgElevated },
  content: { padding: 20, paddingBottom: TAB_BAR_CLEARANCE },
  intro: { color: Theme.colors.textSub, fontSize: 14, lineHeight: 20, marginBottom: 16 },
  card: {
    backgroundColor: Theme.colors.surface,
    borderRadius: Theme.radius.lg,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    overflow: 'hidden',
  },
  row: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: Theme.colors.surfaceUp,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Theme.colors.border,
  },
  rowText: { flex: 1 },
  rowLabel: { color: Theme.colors.text, fontSize: 15, fontWeight: '600' },
  rowSub: { color: Theme.colors.textMuted, fontSize: 12, marginTop: 2 },
  divider: { height: 1, backgroundColor: Theme.colors.border, marginLeft: 64 },
});
