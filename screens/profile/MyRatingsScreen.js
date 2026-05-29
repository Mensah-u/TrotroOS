import { Ionicons } from '@expo/vector-icons';
import { useCallback, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';

import BrandedLoader from '@/components/BrandedLoader';
import ProfileHeader from '@/components/ProfileHeader';
import { TAB_BAR_CLEARANCE } from '@/constants/layout';
import { getOrCreateDeviceId } from '@/services/passengerProfile';
import { getPassengerRatings } from '@/services/supabase';

const C = {
  BG: '#121212', SURFACE: '#1E1E1E', BORDER: 'rgba(255,255,255,0.07)',
  ACCENT: '#F36F21', STAR: '#FBBF24', TEXT: '#FFFFFF', TEXT_SUB: '#E0E0E0', TEXT_MUTED: '#A8A8A8',
};

function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
}

function Stars({ count }) {
  return (
    <View style={styles.stars}>
      {[1, 2, 3, 4, 5].map((s) => (
        <Ionicons key={s} name={s <= count ? 'star' : 'star-outline'} size={14} color={C.STAR} />
      ))}
    </View>
  );
}

function RatingRow({ item }) {
  const trip = item.trips ?? {};
  const mate = trip.mate_profiles ?? {};
  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <Stars count={item.stars} />
        <Text style={styles.date}>{formatDate(item.created_at)}</Text>
      </View>
      <Text style={styles.route} numberOfLines={1}>{trip.route ?? `${trip.origin ?? '—'} → ${trip.destination ?? '—'}`}</Text>
      {mate.full_name ? <Text style={styles.mate}>Driver: {mate.full_name}</Text> : null}
      {item.comment ? <Text style={styles.comment}>{item.comment}</Text> : null}
    </View>
  );
}

export default function MyRatingsScreen({ navigation }) {
  const [loading, setLoading] = useState(true);
  const [ratings, setRatings] = useState([]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        setLoading(true);
        const deviceId = await getOrCreateDeviceId();
        if (!deviceId) { setRatings([]); setLoading(false); return; }
        const { data } = await getPassengerRatings(deviceId);
        if (active) { setRatings(data ?? []); setLoading(false); }
      })();
      return () => { active = false; };
    }, []),
  );

  if (loading) return <BrandedLoader message="Loading ratings" />;

  const avg = ratings.length
    ? (ratings.reduce((s, r) => s + r.stars, 0) / ratings.length).toFixed(1)
    : null;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ProfileHeader navigation={navigation} title="My Ratings" />
      {avg ? (
        <View style={styles.summary}>
          <Ionicons name="star" size={22} color={C.STAR} />
          <Text style={styles.summaryValue}>{avg}</Text>
          <Text style={styles.summarySub}>{ratings.length} rating{ratings.length === 1 ? '' : 's'} given</Text>
        </View>
      ) : null}
      <FlatList
        contentContainerStyle={styles.list}
        data={ratings}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => <RatingRow item={item} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="star-outline" size={40} color={C.TEXT_MUTED} />
            <Text style={styles.emptyTitle}>No ratings yet</Text>
            <Text style={styles.emptySub}>Rate your mate after a trip completes — they'll show up here.</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.BG },
  summary: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 20, paddingVertical: 16, marginHorizontal: 20, marginTop: 16, backgroundColor: C.SURFACE, borderRadius: 14, borderWidth: 1, borderColor: C.BORDER },
  summaryValue: { color: C.TEXT, fontSize: 24, fontWeight: '800' },
  summarySub: { color: C.TEXT_SUB, fontSize: 13, marginLeft: 4 },
  list: { padding: 20, paddingBottom: TAB_BAR_CLEARANCE },
  card: { backgroundColor: C.SURFACE, borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: C.BORDER },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  stars: { flexDirection: 'row', gap: 2 },
  date: { color: C.TEXT_MUTED, fontSize: 12 },
  route: { color: C.TEXT, fontSize: 15, fontWeight: '700' },
  mate: { color: C.TEXT_SUB, fontSize: 13, marginTop: 4 },
  comment: { color: C.TEXT_SUB, fontSize: 13, marginTop: 8, fontStyle: 'italic' },
  empty: { alignItems: 'center', paddingTop: 60, gap: 8, paddingHorizontal: 24 },
  emptyTitle: { color: C.TEXT, fontSize: 16, fontWeight: '700' },
  emptySub: { color: C.TEXT_MUTED, fontSize: 13, textAlign: 'center' },
});
