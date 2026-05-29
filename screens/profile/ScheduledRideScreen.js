import { Ionicons } from '@expo/vector-icons';
import { useCallback, useState } from 'react';
import {
  Alert,
  FlatList,
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
import PremiumButton from '@/components/PremiumButton';
import { TAB_BAR_CLEARANCE } from '@/constants/layout';
import { findRouteByPlaces, formatRoute, getPickupStopsForRoute, routes } from '@/constants/routes';
import { Theme } from '@/constants/theme';
import { useI18n } from '@/context/I18nContext';
import {
  cancelScheduledDemand,
  createScheduledDemand,
  fetchScheduledDemand,
} from '@/services/featuresV14';
import { getOrCreateDeviceId } from '@/services/passengerProfile';

function formatWhen(iso) {
  try {
    return new Date(iso).toLocaleString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export default function ScheduledRideScreen({ navigation }) {
  const { t } = useI18n();
  const [deviceId, setDeviceId] = useState(null);
  const [fromPlace, setFromPlace] = useState('Tech Junction');
  const [toPlace, setToPlace] = useState('KNUST Campus');
  const [pickupStop, setPickupStop] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [items, setItems] = useState([]);
  const [saving, setSaving] = useState(false);

  const route = findRouteByPlaces(fromPlace, toPlace);
  const stops = route ? getPickupStopsForRoute(route) : [];

  const reload = useCallback(async () => {
    const id = deviceId ?? (await getOrCreateDeviceId());
    if (!deviceId) setDeviceId(id);
    const { data } = await fetchScheduledDemand(id);
    setItems(data ?? []);
  }, [deviceId]);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  const schedule = async () => {
    if (!fromPlace || !toPlace) {
      Alert.alert('Route required', 'Pick origin and destination.');
      return;
    }
    const when = scheduledAt.trim()
      ? new Date(scheduledAt)
      : new Date(Date.now() + 60 * 60 * 1000);
    if (Number.isNaN(when.getTime())) {
      Alert.alert('Invalid time', 'Use format: 2026-05-28 07:30 or leave blank for +1 hour.');
      return;
    }
    setSaving(true);
    try {
      const id = deviceId ?? (await getOrCreateDeviceId());
      const { error } = await createScheduledDemand({
        passengerId: id,
        routeLabel: formatRoute({ origin: fromPlace, destination: toPlace }),
        pickupStop: pickupStop || fromPlace,
        scheduledAt: when.toISOString(),
      });
      if (error) throw error;
      Alert.alert('Scheduled', 'Mates will see your demand closer to that time.');
      setScheduledAt('');
      reload();
    } catch (e) {
      Alert.alert('Could not schedule', e.message ?? 'Run supabase/FIX_v14_features.sql first.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ProfileHeader navigation={navigation} title={t('scheduleRide')} />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.intro}>
          Tell mates when you usually need a ride — great for school or work commutes.
        </Text>

        <View style={styles.card}>
          <Text style={styles.label}>From</Text>
          <TextInput value={fromPlace} onChangeText={setFromPlace} style={styles.input} />
          <Text style={styles.label}>To</Text>
          <TextInput value={toPlace} onChangeText={setToPlace} style={styles.input} />
          {stops.length ? (
            <>
              <Text style={styles.label}>{t('pickupStop')}</Text>
              <View style={styles.chips}>
                {stops.map((s) => (
                  <Pressable
                    key={s}
                    onPress={() => setPickupStop(s)}
                    style={[styles.chip, pickupStop === s && styles.chipActive]}>
                    <Text style={[styles.chipText, pickupStop === s && styles.chipTextActive]}>{s}</Text>
                  </Pressable>
                ))}
              </View>
            </>
          ) : null}
          <Text style={styles.label}>When (optional ISO/local)</Text>
          <TextInput
            value={scheduledAt}
            onChangeText={setScheduledAt}
            placeholder="Leave blank = 1 hour from now"
            placeholderTextColor={Theme.colors.textMuted}
            style={styles.input}
          />
          <PremiumButton
            label={t('scheduleRide')}
            variant="passenger"
            loading={saving}
            onPress={schedule}
            icon={<Ionicons name="calendar-outline" size={18} color="#fff" />}
          />
        </View>

        <Text style={styles.sectionTitle}>Your scheduled rides</Text>
        <FlatList
          data={items}
          scrollEnabled={false}
          keyExtractor={(item) => item.id}
          ListEmptyComponent={
            <Text style={styles.empty}>No scheduled rides yet.</Text>
          }
          renderItem={({ item }) => (
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>{item.route_label}</Text>
                <Text style={styles.rowSub}>
                  {item.pickup_stop ? `${item.pickup_stop} · ` : ''}
                  {formatWhen(item.scheduled_at)}
                </Text>
              </View>
              <Pressable
                onPress={() =>
                  cancelScheduledDemand(item.id, deviceId).then(reload)
                }>
                <Text style={styles.cancel}>Cancel</Text>
              </Pressable>
            </View>
          )}
        />

        <Text style={styles.hint}>Quick routes</Text>
        <View style={styles.chips}>
          {routes.slice(0, 4).map((r) => (
            <Pressable
              key={r.id}
              onPress={() => {
                setFromPlace(r.origin);
                setToPlace(r.destination);
              }}
              style={styles.chip}>
              <Text style={styles.chipText}>{formatRoute(r)}</Text>
            </Pressable>
          ))}
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
    padding: 16,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    gap: 8,
    marginBottom: 20,
  },
  label: { color: Theme.colors.textMuted, fontSize: 12, fontWeight: '700', marginTop: 4 },
  input: {
    backgroundColor: Theme.colors.bgElevated,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: Theme.colors.text,
    borderWidth: 1,
    borderColor: Theme.colors.border,
  },
  sectionTitle: { color: Theme.colors.text, fontSize: 16, fontWeight: '800', marginBottom: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Theme.colors.border,
  },
  rowTitle: { color: Theme.colors.text, fontSize: 14, fontWeight: '700' },
  rowSub: { color: Theme.colors.textSub, fontSize: 12, marginTop: 2 },
  cancel: { color: Theme.colors.danger, fontWeight: '700', fontSize: 13 },
  empty: { color: Theme.colors.textMuted, fontSize: 13, marginBottom: 12 },
  hint: { color: Theme.colors.textMuted, fontSize: 12, marginTop: 8, marginBottom: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: Theme.colors.surface,
    borderWidth: 1,
    borderColor: Theme.colors.border,
  },
  chipActive: { borderColor: Theme.colors.passenger, backgroundColor: Theme.colors.passengerSoft },
  chipText: { color: Theme.colors.textSub, fontSize: 12, fontWeight: '600' },
  chipTextActive: { color: Theme.colors.passenger },
});
