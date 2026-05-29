import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Theme } from '@/constants/theme';

export default function RouteResultsHeader({
  fromPlace,
  toPlace,
  rideCount,
  routeSummary,
  onEditRoute,
}) {
  return (
    <View style={styles.wrap}>
      <LinearGradient colors={Theme.gradients.passengerHero} style={styles.hero}>
        <View style={styles.heroTop}>
          <Pressable
            onPress={onEditRoute}
            disabled={!onEditRoute}
            style={({ pressed }) => [
              styles.routePill,
              onEditRoute && pressed && { opacity: 0.85 },
            ]}>
            <Ionicons name="navigate" size={14} color={Theme.colors.passenger} />
            <Text style={styles.routePillText} numberOfLines={1}>
              {fromPlace} → {toPlace}
            </Text>
            {onEditRoute ? (
              <Ionicons name="create-outline" size={14} color={Theme.colors.textMuted} />
            ) : null}
          </Pressable>
          {rideCount > 0 ? (
            <View style={styles.countBadge}>
              <Text style={styles.countBadgeText}>
                {rideCount} LIVE RIDE{rideCount === 1 ? '' : 'S'}
              </Text>
            </View>
          ) : null}
        </View>

        {rideCount > 0 && routeSummary ? (
          <>
            <Text style={styles.heroTitle}>Tap a ride to reserve</Text>
            <Text style={styles.heroSub}>
              Pickup ~{routeSummary.label}
              {routeSummary.liveCount > 0 ? ` · ${routeSummary.liveCount} live GPS` : ''}
            </Text>
          </>
        ) : (
          <>
            <Text style={styles.heroTitle}>No trotros live yet</Text>
            <Text style={styles.heroSub}>
              Join the queue below — mates on this route will see you waiting.
            </Text>
          </>
        )}
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 8 },
  hero: {
    borderRadius: Theme.radius.xl,
    padding: 14,
    borderWidth: 1,
    borderColor: Theme.colors.passenger + '33',
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  routePill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Theme.colors.glass,
    borderRadius: Theme.radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    minWidth: 0,
  },
  routePillText: { color: Theme.colors.text, fontSize: 13, fontWeight: '800', flex: 1 },
  countBadge: {
    flexShrink: 0,
    backgroundColor: Theme.colors.success + '22',
    borderRadius: Theme.radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: Theme.colors.success + '44',
  },
  countBadgeText: { color: Theme.colors.success, fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  heroTitle: { color: Theme.colors.text, fontSize: 17, fontWeight: '800', letterSpacing: -0.3 },
  heroSub: { color: Theme.colors.textSub, fontSize: 12, fontWeight: '600', marginTop: 3, lineHeight: 17 },
  statsRow: {
    flexDirection: 'row',
    marginTop: 16,
    backgroundColor: Theme.colors.glass,
    borderRadius: Theme.radius.lg,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    overflow: 'hidden',
  },
  statBox: { flex: 1, padding: 14, alignItems: 'flex-start' },
  statDivider: { width: 1, backgroundColor: Theme.colors.border },
  statLabel: { color: Theme.colors.textMuted, fontSize: 10, fontWeight: '800', letterSpacing: 0.5, marginTop: 6 },
  statValue: { color: Theme.colors.text, fontSize: 18, fontWeight: '900', marginTop: 2 },
  statValueMuted: { color: Theme.colors.textSub, fontSize: 16, fontWeight: '800', marginTop: 2 },
  statHint: { color: Theme.colors.textMuted, fontSize: 10, fontWeight: '600', marginTop: 4 },
});
