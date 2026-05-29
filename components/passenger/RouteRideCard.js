import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Theme, getSeatStatus, glowShadow } from '@/constants/theme';
import { getVehicleIcon } from '@/constants/vehicleTypes';
import { formatDistance } from '@/utils/rideEta';
import { hapticSelect } from '@/utils/haptics';

const C = {
  ACCENT: Theme.colors.mate,
  ACCENT_SOFT: Theme.colors.mateSoft,
  SUCCESS: Theme.colors.success,
  WARN: Theme.colors.seatFilling,
  DANGER: Theme.colors.error,
  FULL: Theme.colors.seatFull,
  TEXT: Theme.colors.text,
  TEXT_SUB: Theme.colors.textSub,
  TEXT_MUTED: Theme.colors.textMuted,
  BORDER: Theme.colors.border,
  SURFACE: Theme.colors.surface,
  SURFACE_UP: Theme.colors.surfaceUp,
};

export default function RouteRideCard({
  trip,
  eta,
  demand,
  rating,
  verifiedMate,
  selected,
  onSelect,
  onViewDetails,
  onReserve,
  onQueue,
}) {
  const isFull = trip.availableSeats === 0 || trip.status === 'full';
  const { label, color, dot } = getSeatStatus(trip.availableSeats);
  const waitingCount = demand ?? 0;
  const isLiveEta = eta?.confidence === 'live';

  const handleSelect = () => {
    if (isFull) return;
    hapticSelect();
    onSelect(trip);
  };

  return (
    <Pressable
      onPress={handleSelect}
      disabled={isFull}
      style={({ pressed }) => [
        styles.card,
        selected && styles.cardSelected,
        isFull && styles.cardFull,
        pressed && !isFull && { opacity: 0.94 },
      ]}>
      {selected ? (
        <LinearGradient
          colors={[Theme.colors.passenger + '33', Theme.colors.passenger + '08']}
          style={StyleSheet.absoluteFill}
        />
      ) : null}

      <View style={[styles.cardAccent, { backgroundColor: isFull ? C.FULL : selected ? Theme.colors.passenger : C.ACCENT }]} />

      <View style={styles.cardInner}>
        {/* ETA hero row */}
        {!isFull ? (
          <View style={styles.etaRow}>
            <View style={styles.etaIcon}>
              <Ionicons name="time-outline" size={18} color={Theme.colors.passenger} />
            </View>
            <View style={styles.etaText}>
              <Text style={styles.etaLabel}>Arrives in</Text>
              <Text style={styles.etaValue}>{eta?.label ?? 'Estimating…'}</Text>
            </View>
            <View style={styles.etaMeta}>
              {isLiveEta && eta?.distanceKm != null ? (
                <Text style={styles.etaDistance}>{formatDistance(eta.distanceKm)}</Text>
              ) : (
                <Text style={styles.etaApprox}>Route estimate</Text>
              )}
              {isLiveEta ? (
                <View style={styles.liveGpsPill}>
                  <View style={styles.liveGpsDot} />
                  <Text style={styles.liveGpsText}>Live GPS</Text>
                </View>
              ) : null}
            </View>
          </View>
        ) : (
          <View style={styles.fullBanner}>
            <Ionicons name="close-circle" size={16} color={C.DANGER} />
            <Text style={styles.fullBannerText}>Full — join the waiting queue</Text>
          </View>
        )}

        <View style={styles.cardTopRow}>
          <View style={styles.cardHeaderText}>
            <View style={styles.routeFlowRow}>
              <Text style={styles.routeFrom} numberOfLines={1}>{trip.originStation}</Text>
              <Ionicons name="arrow-forward" size={14} color={Theme.colors.passenger} />
              <Text style={styles.routeTo} numberOfLines={1}>{trip.destination}</Text>
              {trip.isLive ? <View style={[styles.livePulse, { backgroundColor: dot }]} /> : null}
            </View>
            <Text style={styles.fareInline} numberOfLines={1}>{trip.fare} · pay on board</Text>
            {waitingCount > 0 ? (
              <View style={styles.demandChip}>
                <Ionicons name="people" size={11} color="#FBBF24" />
                <Text style={styles.demandText}>{waitingCount} waiting on route</Text>
              </View>
            ) : null}
          </View>

          <View style={styles.rightCol}>
            {selected ? (
              <View style={styles.selectedBadge}>
                <Ionicons name="checkmark-circle" size={22} color={Theme.colors.passenger} />
              </View>
            ) : null}
            <View style={[styles.badge, { backgroundColor: color + '22', borderColor: color + '55' }]}>
              <Text style={[styles.badgeText, { color }]}>{label}</Text>
            </View>
          </View>
        </View>

        {(trip.mateName || trip.plate || trip.vehicleType) ? (
          <View style={styles.mateRow}>
            {trip.mateName ? (
              <View style={styles.mateIconRow}>
                <View style={styles.mateAvatar}>
                  <Ionicons name="person" size={12} color={C.ACCENT} />
                </View>
                <Text style={styles.mateName} numberOfLines={1}>{trip.mateName}</Text>
                {verifiedMate ? (
                  <View style={styles.verifiedPill}>
                    <Ionicons name="shield-checkmark" size={10} color={C.SUCCESS} />
                    <Text style={styles.verifiedText}>Verified</Text>
                  </View>
                ) : null}
                {rating?.avg ? (
                  <View style={styles.ratingPill}>
                    <Ionicons name="star" size={10} color="#FBBF24" />
                    <Text style={styles.ratingText}>{rating.avg.toFixed(1)}</Text>
                  </View>
                ) : null}
              </View>
            ) : null}
            <View style={styles.mateBadges}>
              {trip.vehicleType ? (
                <View style={styles.vehicleTypePill}>
                  <Ionicons name={getVehicleIcon(trip.vehicleType)} size={11} color={C.TEXT_SUB} />
                  <Text style={styles.vehicleTypeText}>{trip.vehicleType}</Text>
                </View>
              ) : null}
              {trip.plate ? (
                <View style={styles.platePill}>
                  <Text style={styles.plateText}>{trip.plate}</Text>
                </View>
              ) : null}
            </View>
          </View>
        ) : null}

        <View style={styles.cardDivider} />

        <View style={styles.cardBottomRow}>
          <Pressable
            onPress={() => onViewDetails(trip)}
            style={({ pressed }) => [styles.detailsButton, pressed && { opacity: 0.75 }]}>
            <Ionicons name="information-circle-outline" size={16} color={C.TEXT_SUB} />
            <Text style={styles.detailsButtonText}>Details</Text>
          </Pressable>
          <View style={styles.cardActions}>
            {trip.isLive && isFull ? (
              <Pressable
                onPress={() => onQueue(trip)}
                style={({ pressed }) => [styles.queueButton, pressed && { opacity: 0.75 }]}>
                <Ionicons name="time-outline" size={14} color={C.ACCENT} />
                <Text style={styles.queueButtonText}>{"I'm Waiting"}</Text>
              </Pressable>
            ) : null}
            {!isFull ? (
              <Pressable
                onPress={() => (selected ? onReserve(trip) : handleSelect())}
                style={({ pressed }) => [
                  styles.chooseButton,
                  selected && styles.chooseButtonSelected,
                  pressed && { opacity: 0.85 },
                ]}>
                <Text style={styles.chooseButtonText}>
                  {selected ? 'Reserve' : 'Choose ride'}
                </Text>
                <Ionicons
                  name={selected ? 'checkmark' : 'chevron-forward'}
                  size={16}
                  color="#FFFFFF"
                />
              </Pressable>
            ) : null}
          </View>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: C.SURFACE,
    borderRadius: 18,
    marginBottom: 14,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: C.BORDER,
  },
  cardSelected: {
    borderColor: Theme.colors.passenger + '88',
    ...glowShadow(Theme.colors.passenger, 0.2),
  },
  cardFull: { opacity: 0.85 },
  cardAccent: { width: 4 },
  cardInner: { flex: 1, padding: 16 },

  etaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Theme.colors.passengerSoft,
    borderRadius: 14,
    padding: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: Theme.colors.passenger + '33',
  },
  etaIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: Theme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  etaText: { flex: 1 },
  etaLabel: { color: Theme.colors.textMuted, fontSize: 11, fontWeight: '700', letterSpacing: 0.3 },
  etaValue: { color: Theme.colors.text, fontSize: 20, fontWeight: '900', letterSpacing: -0.5, marginTop: 1 },
  etaMeta: { alignItems: 'flex-end', gap: 4 },
  etaDistance: { color: Theme.colors.textSub, fontSize: 11, fontWeight: '700' },
  etaApprox: { color: Theme.colors.textMuted, fontSize: 10, fontWeight: '600' },
  liveGpsPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(34,197,94,0.15)',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  liveGpsDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: C.SUCCESS },
  liveGpsText: { color: C.SUCCESS, fontSize: 9, fontWeight: '800', letterSpacing: 0.3 },

  fullBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(239,68,68,0.12)',
    borderRadius: 10,
    padding: 10,
    marginBottom: 12,
  },
  fullBannerText: { color: C.DANGER, fontSize: 12, fontWeight: '700' },

  cardTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  cardHeaderText: { flex: 1, paddingRight: 12 },
  routeFlowRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  routeFrom: { color: Theme.colors.text, fontSize: 16, fontWeight: '800', flexShrink: 1 },
  routeTo: { color: Theme.colors.passenger, fontSize: 16, fontWeight: '800', flexShrink: 1 },
  livePulse: { width: 7, height: 7, borderRadius: 4 },
  fareInline: { color: C.TEXT_SUB, fontSize: 12, fontWeight: '600', marginTop: 4 },

  rightCol: { alignItems: 'flex-end', gap: 8 },
  selectedBadge: {},
  badge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, borderWidth: 1 },
  badgeText: { fontSize: 12, fontWeight: '700' },

  demandChip: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(251,191,36,0.12)',
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
    marginTop: 6,
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.25)',
  },
  demandText: { color: '#FBBF24', fontSize: 11, fontWeight: '700' },

  mateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 12,
    flexWrap: 'wrap',
  },
  mateIconRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 },
  mateAvatar: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: C.ACCENT_SOFT, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: C.ACCENT + '40',
  },
  mateName: { color: C.TEXT, fontSize: 13, fontWeight: '700', flexShrink: 1 },
  ratingPill: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: 'rgba(251,191,36,0.12)', borderRadius: 6,
    paddingHorizontal: 6, paddingVertical: 2, marginLeft: 6,
    borderWidth: 1, borderColor: 'rgba(251,191,36,0.25)',
  },
  ratingText: { color: '#FBBF24', fontSize: 10, fontWeight: '800' },
  verifiedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: 'rgba(34,197,94,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.35)',
  },
  verifiedText: { color: C.SUCCESS, fontSize: 9, fontWeight: '800' },
  mateBadges: { flexDirection: 'row', gap: 6 },
  vehicleTypePill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 6,
    paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderColor: C.BORDER,
  },
  vehicleTypeText: { color: C.TEXT_SUB, fontSize: 11, fontWeight: '600' },
  platePill: {
    backgroundColor: '#121212', borderRadius: 6,
    paddingHorizontal: 9, paddingVertical: 4,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
  },
  plateText: { color: C.TEXT, fontSize: 11.5, fontWeight: '800', letterSpacing: 1.2 },

  cardDivider: { height: 1, backgroundColor: C.BORDER, marginVertical: 12 },
  cardBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
    flex: 1,
    flexShrink: 1,
  },
  detailsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    minHeight: 44,
    borderRadius: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: C.BORDER,
    backgroundColor: C.SURFACE_UP,
    flexShrink: 0,
  },
  detailsButtonText: { color: C.TEXT_SUB, fontSize: 13, fontWeight: '700' },
  queueButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5,
    minHeight: 44, borderRadius: 10, paddingHorizontal: 12,
    borderWidth: 1.5, borderColor: C.ACCENT,
  },
  queueButtonText: { color: C.ACCENT, fontSize: 13, fontWeight: '700' },
  chooseButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    minHeight: 44, backgroundColor: C.ACCENT, borderRadius: 10,
    paddingHorizontal: 16,
  },
  chooseButtonSelected: { backgroundColor: Theme.colors.passenger },
  chooseButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
});
