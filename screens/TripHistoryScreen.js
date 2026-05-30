import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';

import BrandedLoader from '@/components/BrandedLoader';
import { TAB_BAR_CLEARANCE } from '@/constants/layout';
import { formatRoute, getRouteFare, routes } from '@/constants/routes';
import { getOrCreateDeviceId } from '@/services/passengerProfile';
import {
  cancelReservation,
  deleteDriverLocation,
  endTrip,
  getCurrentMate,
  getMateTripHistory,
  getPassengerHistory,
  subscribeToMateTrips,
  subscribeToPassengerHistory,
  supabase,
} from '@/services/supabase';
import { C } from '@/constants/theme';

const TABS = [
  { id: 'passenger', label: 'My Rides',  icon: 'person' },
  { id: 'mate',      label: 'My Trips',  icon: 'bus' },
];

// ─── Formatters ──────────────────────────────────────────────────────────────
function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const today = new Date();
  const yest  = new Date(Date.now() - 86400000);
  const sameDay = (a, b) => a.toDateString() === b.toDateString();

  const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  if (sameDay(d, today)) return `Today, ${time}`;
  if (sameDay(d, yest))  return `Yesterday, ${time}`;
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' }) + `, ${time}`;
}

function statusMeta(status) {
  switch (status) {
    case 'active':    return { color: C.SUCCESS, label: 'Active' };
    case 'completed': return { color: C.TEXT_SUB, label: 'Completed' };
    case 'full':      return { color: C.DANGER,  label: 'Full' };
    case 'expired':   return { color: C.TEXT_MUTED, label: 'Expired' };
    case 'cancelled': return { color: C.TEXT_MUTED, label: 'Cancelled' };
    default:          return { color: C.TEXT_SUB, label: status ?? 'Unknown' };
  }
}

function fareForRoute(routeLabel) {
  const match = routes.find((r) => formatRoute(r) === routeLabel);
  return getRouteFare(match ?? null);
}

// ─── Row components ──────────────────────────────────────────────────────────
function PassengerRow({ reservation, navigation, onCloseRide }) {
  const trip = reservation.trips ?? {};
  const mate = trip.mate_profiles ?? {};
  const s    = statusMeta(reservation.status);
  const fare = fareForRoute(trip.route ?? '');
  const canClose = reservation.status === 'active';

  const bookAgain = () => {
    const parts = (trip.route ?? '').split('→').map((p) => p.trim());
    navigation.getParent()?.navigate('Find Ride', {
      prefillFrom: trip.origin ?? parts[0],
      prefillTo: trip.destination ?? parts[1],
    });
  };

  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <View style={styles.cardIconWrap}>
          <Ionicons name="bus" size={18} color={C.ACCENT} />
        </View>
        <View style={styles.cardMain}>
          <Text style={styles.cardTitle} numberOfLines={1}>{trip.destination ?? 'Trip'}</Text>
          <Text style={styles.cardSub} numberOfLines={1}>{trip.route ?? `from ${trip.origin ?? '—'}`}</Text>
        </View>
        <View style={[styles.statusPill, { borderColor: s.color + '55', backgroundColor: s.color + '18' }]}>
          <Text style={[styles.statusText, { color: s.color }]}>{s.label}</Text>
        </View>
      </View>

      <View style={styles.cardDivider} />

      <View style={styles.cardMeta}>
        <View style={styles.metaItem}>
          <Ionicons name="time-outline" size={13} color={C.TEXT_MUTED} />
          <Text style={styles.metaText}>{formatDate(reservation.created_at)}</Text>
        </View>
        {mate.full_name ? (
          <View style={styles.metaItem}>
            <Ionicons name="person-outline" size={13} color={C.TEXT_MUTED} />
            <Text style={styles.metaText} numberOfLines={1}>{mate.full_name}</Text>
          </View>
        ) : null}
        {mate.vehicle_registration ? (
          <View style={styles.platePill}>
            <Text style={styles.plateText}>{mate.vehicle_registration}</Text>
          </View>
        ) : null}
        {fare ? (
          <View style={styles.farePill}>
            <Text style={styles.fareText}>GHS {fare}</Text>
          </View>
        ) : null}
        <Pressable onPress={bookAgain} style={styles.rebookBtn}>
          <Text style={styles.rebookText}>Book again</Text>
        </Pressable>
        {canClose ? (
          <Pressable onPress={() => onCloseRide?.(reservation)} style={styles.closeRideBtn}>
            <Ionicons name="close-outline" size={14} color={C.DANGER} />
            <Text style={styles.closeRideText}>Close ride</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

function MateTripRow({ trip, onCloseTrip }) {
  const s = statusMeta(trip.status);
  const occupied = (trip.total_seats ?? 0) - (trip.available_seats ?? 0);
  const fare = fareForRoute(trip.route ?? '');
  const estEarnings = occupied * fare;
  const canClose = trip.status === 'active' || trip.status === 'full';

  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <View style={styles.cardIconWrap}>
          <Ionicons name="navigate" size={18} color={C.ACCENT} />
        </View>
        <View style={styles.cardMain}>
          <Text style={styles.cardTitle} numberOfLines={1}>{trip.destination}</Text>
          <Text style={styles.cardSub} numberOfLines={1}>{trip.route ?? `from ${trip.origin}`}</Text>
        </View>
        <View style={[styles.statusPill, { borderColor: s.color + '55', backgroundColor: s.color + '18' }]}>
          <Text style={[styles.statusText, { color: s.color }]}>{s.label}</Text>
        </View>
      </View>

      <View style={styles.cardDivider} />

      <View style={styles.cardMeta}>
        <View style={styles.metaItem}>
          <Ionicons name="time-outline" size={13} color={C.TEXT_MUTED} />
          <Text style={styles.metaText}>{formatDate(trip.created_at)}</Text>
        </View>
        <View style={styles.metaItem}>
          <Ionicons name="people-outline" size={13} color={C.TEXT_MUTED} />
          <Text style={styles.metaText}>{occupied} of {trip.total_seats} onboard</Text>
        </View>
        {estEarnings > 0 ? (
          <View style={styles.farePill}>
            <Text style={styles.fareText}>~GHS {estEarnings}</Text>
          </View>
        ) : null}
        {canClose ? (
          <Pressable onPress={() => onCloseTrip?.(trip)} style={styles.closeRideBtn}>
            <Ionicons name="close-outline" size={14} color={C.DANGER} />
            <Text style={styles.closeRideText}>Close trip</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

// ─── Empty + error states ────────────────────────────────────────────────────
function EmptyState({ icon, title, sub }) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <Ionicons name={icon} size={32} color={C.TEXT_MUTED} />
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptySub}>{sub}</Text>
    </View>
  );
}

// ─── Main screen ─────────────────────────────────────────────────────────────
export default function TripHistoryScreen({ navigation }) {
  const [tab,        setTab]        = useState('passenger');
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [reservations, setReservations] = useState([]);
  const [trips,      setTrips]      = useState([]);
  const [mateUserId, setMateUserId] = useState(null);
  const [deviceId,   setDeviceId]   = useState(null);
  const channelRef = useRef(null);

  const loadHistory = useCallback(async (showLoader = false) => {
    if (showLoader) setLoading(true);
    const did = deviceId ?? (await getOrCreateDeviceId());
    if (did) setDeviceId(did);
    if (did) {
      const { data } = await getPassengerHistory(did);
      setReservations(data ?? []);
    }
    const { data: userData } = await getCurrentMate();
    const mid = userData?.user?.id ?? null;
    setMateUserId(mid);
    if (mid) {
      const { data } = await getMateTripHistory(mid);
      setTrips(data ?? []);
    }
    if (showLoader) setLoading(false);
    setRefreshing(false);
  }, [deviceId]);

  useFocusEffect(
    useCallback(() => {
      loadHistory(true);
    }, [loadHistory]),
  );

  useEffect(() => {
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
    if (tab === 'mate' && mateUserId) {
      channelRef.current = subscribeToMateTrips(mateUserId, setTrips);
    } else if (tab === 'passenger' && deviceId) {
      channelRef.current = subscribeToPassengerHistory(deviceId, setReservations);
    }
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [tab, mateUserId, deviceId]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadHistory(false);
  }, [loadHistory]);

  const handleClosePassengerRide = useCallback((reservation) => {
    Alert.alert(
      'Close ride?',
      'Your seat will be released and this ride removed from your active list.',
      [
        { text: 'Keep ride', style: 'cancel' },
        {
          text: 'Close ride',
          style: 'destructive',
          onPress: async () => {
            const did = deviceId ?? (await getOrCreateDeviceId());
            if (!did) return;
            const { ok } = await cancelReservation(reservation.id, did);
            if (!ok) {
              Alert.alert('Could not close ride', 'Try again in a moment.');
              return;
            }
            loadHistory(false);
          },
        },
      ],
    );
  }, [deviceId, loadHistory]);

  const handleCloseMateTrip = useCallback((trip) => {
    Alert.alert(
      'Close trip?',
      'This trip will be marked completed and removed from the live map for passengers.',
      [
        { text: 'Keep trip', style: 'cancel' },
        {
          text: 'Close trip',
          style: 'destructive',
          onPress: async () => {
            try {
              await endTrip(trip.id);
              await deleteDriverLocation(mateUserId).catch(() => {});
              loadHistory(false);
            } catch {
              Alert.alert('Could not close trip', 'Make sure you are signed in as a mate and try again.');
            }
          },
        },
      ],
    );
  }, [mateUserId, loadHistory]);

  if (loading) return <BrandedLoader message="Loading history" />;

  const data = tab === 'passenger' ? reservations : trips;
  const activeCount = tab === 'mate'
    ? trips.filter((t) => t.status === 'active' || t.status === 'full').length
    : reservations.filter((r) => r.status === 'active').length;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        {navigation?.canGoBack?.() ? (
          <Pressable onPress={() => navigation.goBack()} hitSlop={12} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={20} color={C.TEXT} />
          </Pressable>
        ) : <View style={{ width: 36 }} />}
        <Text style={styles.headerTitle}>Trip History</Text>
        <View style={{ width: 36 }} />
      </View>

      {/* Tabs */}
      <View style={styles.tabRow}>
        {TABS.map((t) => {
          const active = t.id === tab;
          const disabled = t.id === 'mate' && !mateUserId;
          return (
            <Pressable
              key={t.id}
              disabled={disabled}
              onPress={() => setTab(t.id)}
              style={({ pressed }) => [
                styles.tab,
                active && styles.tabActive,
                disabled && { opacity: 0.4 },
                pressed && !disabled && { opacity: 0.85 },
              ]}>
              <Ionicons name={active ? t.icon : `${t.icon}-outline`} size={15} color={active ? C.ACCENT : C.TEXT_SUB} />
              <Text style={[styles.tabText, active && styles.tabTextActive]}>{t.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {activeCount > 0 ? (
        <View style={styles.liveBanner}>
          <View style={styles.liveDot} />
          <Text style={styles.liveBannerText}>
            {activeCount} live {tab === 'mate' ? 'trip' : 'ride'}{activeCount === 1 ? '' : 's'} · tap Close to remove
          </Text>
        </View>
      ) : null}

      <FlatList
        contentContainerStyle={styles.listContent}
        data={data}
        keyExtractor={(item) => String(item.id)}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.ACCENT} />
        }
        renderItem={({ item }) =>
          tab === 'passenger' ? (
            <PassengerRow
              reservation={item}
              navigation={navigation}
              onCloseRide={handleClosePassengerRide}
            />
          ) : (
            <MateTripRow trip={item} onCloseTrip={handleCloseMateTrip} />
          )
        }
        ListEmptyComponent={
          tab === 'passenger' ? (
            <EmptyState icon="bus-outline" title="No rides yet" sub="When you reserve a trip, it'll show up here." />
          ) : !mateUserId ? (
            <EmptyState icon="log-in-outline" title="Sign in as mate" sub="Your trip history is only visible after you log in on the Mate tab." />
          ) : (
            <EmptyState icon="navigate-outline" title="No trips yet" sub="Trips you start as a mate will be saved here automatically." />
          )
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:         { flex: 1, backgroundColor: C.BG },

  header:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.BORDER },
  backBtn:      { width: 36, height: 36, borderRadius: 10, backgroundColor: C.SURFACE, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.BORDER },
  headerTitle:  { color: C.TEXT, fontSize: 18, fontWeight: '800' },

  tabRow:       { flexDirection: 'row', gap: 8, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 },
  tab:          { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 11, borderRadius: 12, backgroundColor: C.SURFACE, borderWidth: 1, borderColor: C.BORDER },
  tabActive:    { borderColor: C.ACCENT + '70', backgroundColor: 'rgba(243,111,33,0.08)' },
  tabText:      { color: C.TEXT_SUB, fontSize: 13, fontWeight: '700' },
  tabTextActive:{ color: C.ACCENT },

  liveBanner:     { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 20, marginBottom: 8, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: 'rgba(34,197,94,0.1)', borderWidth: 1, borderColor: 'rgba(34,197,94,0.25)' },
  liveDot:        { width: 8, height: 8, borderRadius: 4, backgroundColor: C.SUCCESS },
  liveBannerText: { color: C.SUCCESS, fontSize: 12, fontWeight: '700', flex: 1 },

  listContent:  { paddingHorizontal: 20, paddingTop: 8, paddingBottom: TAB_BAR_CLEARANCE },

  card:         { backgroundColor: C.SURFACE, borderRadius: 16, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: C.BORDER },
  cardTop:      { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  cardIconWrap: { width: 38, height: 38, borderRadius: 10, backgroundColor: 'rgba(243,111,33,0.1)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(243,111,33,0.3)' },
  cardMain:     { flex: 1, paddingRight: 8, minWidth: 0 },
  cardTitle:    { color: C.TEXT, fontSize: 16, fontWeight: '800', letterSpacing: -0.2 },
  cardSub:      { color: C.TEXT_SUB, fontSize: 12, fontWeight: '500', marginTop: 3 },

  statusPill:   { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, alignSelf: 'flex-start' },
  statusText:   { fontSize: 11, fontWeight: '800', letterSpacing: 0.3 },

  cardDivider:  { height: 1, backgroundColor: C.BORDER, marginVertical: 10 },
  cardMeta:     { flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' },
  metaItem:     { flexDirection: 'row', alignItems: 'center', gap: 5 },
  metaText:     { color: C.TEXT_SUB, fontSize: 12, fontWeight: '500' },

  platePill:    { marginLeft: 'auto', backgroundColor: '#121212', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
  plateText:    { color: C.TEXT, fontSize: 11, fontWeight: '800', letterSpacing: 1, fontFamily: 'monospace' },
  farePill:     { backgroundColor: 'rgba(34,197,94,0.12)', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: 'rgba(34,197,94,0.25)' },
  fareText:     { color: C.SUCCESS, fontSize: 11, fontWeight: '800' },
  rebookBtn:    { marginLeft: 'auto', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: C.ACCENT + '55' },
  rebookText:   { color: C.ACCENT, fontSize: 11, fontWeight: '800' },
  closeRideBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: C.DANGER + '55',
    backgroundColor: 'rgba(255,82,82,0.08)',
  },
  closeRideText: { color: C.DANGER, fontSize: 11, fontWeight: '800' },

  empty:        { alignItems: 'center', paddingTop: 64, gap: 10 },
  emptyIcon:    { width: 64, height: 64, borderRadius: 20, backgroundColor: C.SURFACE, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.BORDER, marginBottom: 4 },
  emptyTitle:   { color: C.TEXT, fontSize: 16, fontWeight: '700' },
  emptySub:     { color: C.TEXT_MUTED, fontSize: 13, textAlign: 'center', maxWidth: 240 },
});
