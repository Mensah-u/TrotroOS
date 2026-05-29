import { Ionicons } from '@expo/vector-icons';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';

import ProfileHeader from '@/components/ProfileHeader';
import { TAB_BAR_CLEARANCE } from '@/constants/layout';
import { Theme } from '@/constants/theme';
import { getMateEarningsLog, getMateEarningsTotal } from '@/services/mateEarnings';
import { getCurrentMate, getMateTripHistory } from '@/services/supabase';

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function formatGhs(n) {
  return `GHS ${Number(n ?? 0).toFixed(2)}`;
}

function busiestDayLabel(trips) {
  const buckets = {};
  for (const t of trips) {
    const day = startOfDay(t.created_at).toDateString();
    buckets[day] = (buckets[day] ?? 0) + 1;
  }
  const sorted = Object.entries(buckets).sort((a, b) => b[1] - a[1]);
  if (!sorted.length) return null;
  const [day, count] = sorted[0];
  return { day, count };
}

function topRouteLabel(trips) {
  const buckets = {};
  for (const t of trips) {
    const r = t.route ?? '—';
    buckets[r] = (buckets[r] ?? 0) + 1;
  }
  const sorted = Object.entries(buckets).sort((a, b) => b[1] - a[1]);
  if (!sorted.length) return null;
  const [route, count] = sorted[0];
  return { route, count };
}

export default function MateInsightsScreen({ navigation }) {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    weekTrips: 0,
    weekSeats: 0,
    weekEarnings: 0,
    totalEarnings: 0,
    busiestDay: null,
    topRoute: null,
    log: [],
  });

  useFocusEffect(
    useCallback(() => {
      let mounted = true;
      (async () => {
        setLoading(true);
        const { data: userData } = await getCurrentMate();
        const mateId = userData?.user?.id;
        if (!mateId) {
          if (mounted) setLoading(false);
          return;
        }
        const [{ data: trips }, total, log] = await Promise.all([
          getMateTripHistory(mateId, 200),
          getMateEarningsTotal(),
          getMateEarningsLog(),
        ]);
        if (!mounted) return;

        const since = Date.now() - 7 * 24 * 60 * 60 * 1000;
        const weekTrips = (trips ?? []).filter((t) => new Date(t.created_at).getTime() >= since);
        const weekSeats = weekTrips.reduce((s, t) => s + ((t.total_seats ?? 0) - (t.available_seats ?? 0)), 0);
        const weekEarnings = (log ?? [])
          .filter((entry) => new Date(entry.at).getTime() >= since)
          .reduce((sum, entry) => sum + (entry.amountGhs ?? 0), 0);

        setStats({
          weekTrips: weekTrips.length,
          weekSeats,
          weekEarnings,
          totalEarnings: total,
          busiestDay: busiestDayLabel(trips ?? []),
          topRoute: topRouteLabel(trips ?? []),
          log: log ?? [],
        });
        setLoading(false);
      })();
      return () => { mounted = false; };
    }, []),
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ProfileHeader navigation={navigation} title="Insights" />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.intro}>
          A quick view of your driving performance — the last 7 days plus all-time highlights.
        </Text>

        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Ionicons name="bus-outline" size={22} color={Theme.colors.mate} />
            <Text style={styles.statValue}>{loading ? '—' : stats.weekTrips}</Text>
            <Text style={styles.statLabel}>Trips this week</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="people-outline" size={22} color={Theme.colors.mate} />
            <Text style={styles.statValue}>{loading ? '—' : stats.weekSeats}</Text>
            <Text style={styles.statLabel}>Seats filled (7d)</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="wallet-outline" size={22} color={Theme.colors.success} />
            <Text style={[styles.statValue, { color: Theme.colors.success }]}>
              {loading ? '—' : formatGhs(stats.weekEarnings)}
            </Text>
            <Text style={styles.statLabel}>Earnings (7d)</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="trending-up" size={22} color={Theme.colors.gold} />
            <Text style={[styles.statValue, { color: Theme.colors.gold }]}>
              {loading ? '—' : formatGhs(stats.totalEarnings)}
            </Text>
            <Text style={styles.statLabel}>All-time earnings</Text>
          </View>
        </View>

        <Text style={styles.sectionLabel}>HIGHLIGHTS</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <View style={styles.iconWrap}>
              <Ionicons name="calendar-outline" size={18} color={Theme.colors.textSub} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowLabel}>Busiest day</Text>
              <Text style={styles.rowSub}>
                {stats.busiestDay
                  ? `${stats.busiestDay.day} · ${stats.busiestDay.count} trip${stats.busiestDay.count === 1 ? '' : 's'}`
                  : 'Drive a few trips to see your busiest day'}
              </Text>
            </View>
          </View>
          <View style={styles.divider} />
          <View style={styles.row}>
            <View style={styles.iconWrap}>
              <Ionicons name="map-outline" size={18} color={Theme.colors.textSub} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowLabel}>Top route</Text>
              <Text style={styles.rowSub}>
                {stats.topRoute
                  ? `${stats.topRoute.route} · ${stats.topRoute.count} trip${stats.topRoute.count === 1 ? '' : 's'}`
                  : 'No trips yet'}
              </Text>
            </View>
          </View>
        </View>

        <Text style={styles.sectionLabel}>RECENT EARNINGS</Text>
        <View style={styles.card}>
          {stats.log.length === 0 ? (
            <View style={styles.emptyRow}>
              <Ionicons name="cash-outline" size={20} color={Theme.colors.textMuted} />
              <Text style={styles.emptyText}>End a trip to start tracking earnings here.</Text>
            </View>
          ) : (
            stats.log.slice(0, 6).map((entry, idx) => (
              <View key={`${entry.at}-${idx}`}>
                <View style={styles.row}>
                  <View style={[styles.iconWrap, { backgroundColor: 'rgba(34,197,94,0.1)', borderColor: 'rgba(34,197,94,0.25)' }]}>
                    <Ionicons name="cash-outline" size={16} color={Theme.colors.success} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowLabel} numberOfLines={1}>{entry.route ?? 'Trip'}</Text>
                    <Text style={styles.rowSub}>
                      {entry.passengers} pax · {new Date(entry.at).toLocaleDateString()}
                    </Text>
                  </View>
                  <Text style={styles.amount}>{formatGhs(entry.amountGhs)}</Text>
                </View>
                {idx < Math.min(5, stats.log.length - 1) ? <View style={styles.divider} /> : null}
              </View>
            ))
          )}
        </View>

        <Pressable
          onPress={() => navigation.getParent()?.navigate('Trips')}
          style={({ pressed }) => [styles.linkBtn, pressed && { opacity: 0.8 }]}>
          <Text style={styles.linkText}>See full trip history</Text>
          <Ionicons name="chevron-forward" size={14} color={Theme.colors.mate} />
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Theme.colors.bgElevated },
  content: { padding: 20, paddingBottom: TAB_BAR_CLEARANCE },
  intro: { color: Theme.colors.textSub, fontSize: 14, lineHeight: 20, marginBottom: 16 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  statCard: {
    width: '48%',
    backgroundColor: Theme.colors.surface,
    borderRadius: Theme.radius.lg,
    padding: 14, gap: 6,
    borderWidth: 1, borderColor: Theme.colors.border,
  },
  statValue: { color: Theme.colors.text, fontSize: 20, fontWeight: '900', marginTop: 4 },
  statLabel: { color: Theme.colors.textMuted, fontSize: 11, fontWeight: '700', letterSpacing: 0.6 },
  sectionLabel: { color: Theme.colors.textMuted, fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 10 },
  card: {
    backgroundColor: Theme.colors.surface,
    borderRadius: Theme.radius.lg,
    borderWidth: 1, borderColor: Theme.colors.border,
    overflow: 'hidden', marginBottom: 16,
  },
  row: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
  iconWrap: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: Theme.colors.surfaceUp,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Theme.colors.border,
  },
  rowLabel: { color: Theme.colors.text, fontSize: 14, fontWeight: '600' },
  rowSub: { color: Theme.colors.textMuted, fontSize: 12, marginTop: 2 },
  amount: { color: Theme.colors.success, fontSize: 14, fontWeight: '800' },
  divider: { height: 1, backgroundColor: Theme.colors.border, marginLeft: 60 },
  emptyRow: { padding: 14, gap: 8, alignItems: 'center' },
  emptyText: { color: Theme.colors.textMuted, fontSize: 13, textAlign: 'center' },
  linkBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, padding: 8 },
  linkText: { color: Theme.colors.mate, fontSize: 14, fontWeight: '700' },
});
