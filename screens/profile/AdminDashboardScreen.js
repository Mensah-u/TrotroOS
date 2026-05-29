import { Ionicons } from '@expo/vector-icons';
import { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';

import ProfileHeader from '@/components/ProfileHeader';
import { TAB_BAR_CLEARANCE } from '@/constants/layout';
import { Theme } from '@/constants/theme';
import {
  fetchAdminStats,
  fetchOpenSafetyReports,
  fetchRecentTripsAdmin,
} from '@/services/featuresV14';

function StatCard({ label, value, icon, color }) {
  return (
    <View style={styles.stat}>
      <Ionicons name={icon} size={20} color={color} />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

export default function AdminDashboardScreen({ navigation }) {
  const [stats, setStats] = useState(null);
  const [trips, setTrips] = useState([]);
  const [reports, setReports] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const [s, t, r] = await Promise.all([
      fetchAdminStats(),
      fetchRecentTripsAdmin(15),
      fetchOpenSafetyReports(10),
    ]);
    setStats(s);
    setTrips(t.data ?? []);
    setReports(r.data ?? []);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ProfileHeader navigation={navigation} title="Admin dashboard" />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Theme.colors.passenger} />}>
        <Text style={styles.intro}>
          Lightweight ops view — requires Supabase v1.4 tables. For full admin, use server/admin in this repo.
        </Text>

        <View style={styles.statsRow}>
          <StatCard label="Trips" value={stats?.totalTrips ?? '—'} icon="bus" color={Theme.colors.passenger} />
          <StatCard label="Mates" value={stats?.mateCount ?? '—'} icon="people" color={Theme.colors.success} />
          <StatCard label="Open reports" value={stats?.openReports ?? '—'} icon="flag" color={Theme.colors.danger} />
          <StatCard label="Scheduled" value={stats?.scheduledDemand ?? '—'} icon="calendar" color={Theme.colors.gold} />
        </View>

        <Text style={styles.section}>Recent trips</Text>
        {trips.length === 0 ? (
          <Text style={styles.empty}>No trips loaded.</Text>
        ) : (
          trips.map((t) => (
            <View key={t.id} style={styles.row}>
              <Text style={styles.rowTitle} numberOfLines={1}>{t.route}</Text>
              <Text style={styles.rowSub}>
                {t.status} · {t.available_seats}/{t.total_seats} seats
              </Text>
            </View>
          ))
        )}

        <Text style={styles.section}>Open safety reports</Text>
        {reports.length === 0 ? (
          <Text style={styles.empty}>No open reports.</Text>
        ) : (
          reports.map((r) => (
            <View key={r.id} style={styles.row}>
              <Text style={styles.rowTitle}>{r.category}</Text>
              <Text style={styles.rowSub} numberOfLines={2}>{r.description}</Text>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Theme.colors.bgElevated },
  content: { padding: 20, paddingBottom: TAB_BAR_CLEARANCE },
  intro: { color: Theme.colors.textSub, fontSize: 13, lineHeight: 19, marginBottom: 16 },
  statsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  stat: {
    width: '47%',
    backgroundColor: Theme.colors.surface,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    gap: 4,
  },
  statValue: { color: Theme.colors.text, fontSize: 22, fontWeight: '900' },
  statLabel: { color: Theme.colors.textMuted, fontSize: 12, fontWeight: '600' },
  section: { color: Theme.colors.text, fontSize: 16, fontWeight: '800', marginTop: 8, marginBottom: 8 },
  row: {
    backgroundColor: Theme.colors.surface,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: Theme.colors.border,
  },
  rowTitle: { color: Theme.colors.text, fontWeight: '700', fontSize: 14 },
  rowSub: { color: Theme.colors.textSub, fontSize: 12, marginTop: 4 },
  empty: { color: Theme.colors.textMuted, fontSize: 13, marginBottom: 12 },
});
