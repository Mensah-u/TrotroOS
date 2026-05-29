import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import PremiumButton from '@/components/PremiumButton';
import { PASSENGER } from '@/constants/problemSolution';
import { Theme, glowShadow } from '@/constants/theme';
import { getVehicleIcon } from '@/constants/vehicleTypes';
import { estimateTripDuration, formatDistance } from '@/utils/rideEta';

function haversineKm(from, to) {
  if (!from?.latitude || !to?.latitude) return null;
  const R = 6371;
  const dLat = ((to.latitude - from.latitude) * Math.PI) / 180;
  const dLon = ((to.longitude - from.longitude) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((from.latitude * Math.PI) / 180) *
      Math.cos((to.latitude * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function DetailRow({ icon, label, value, valueColor = Theme.colors.text }) {
  return (
    <View style={styles.detailRow}>
      <View style={styles.detailIcon}>
        <Ionicons name={icon} size={18} color={Theme.colors.passenger} />
      </View>
      <View style={styles.detailText}>
        <Text style={styles.detailLabel}>{label}</Text>
        <Text style={[styles.detailValue, { color: valueColor }]} numberOfLines={2}>{value}</Text>
      </View>
    </View>
  );
}

export default function RideDetailsSheet({
  visible,
  trip,
  mode = 'preview',
  rating,
  countdown,
  driverLive,
  passengerCoords,
  driverCoords,
  onClose,
  onReserve,
  onCancel,
  onTrackMap,
  reserving = false,
  reserveReady = true,
  pickupEta,
  routeMeta,
}) {
  const insets = useSafeAreaInsets();
  if (!trip) return null;

  const isActive = mode === 'active';
  const isFull = trip.availableSeats === 0 || trip.status === 'full';
  const distanceKm = haversineKm(passengerCoords, driverCoords);
  const tripDuration = estimateTripDuration(routeMeta);
  const eta = pickupEta ?? trip.eta;

  const status = isActive
    ? (driverLive ? { label: 'Live on map', color: Theme.colors.success, icon: 'radio' }
      : { label: 'Seat reserved', color: Theme.colors.gold, icon: 'time' })
    : isFull
      ? { label: 'Trip full', color: Theme.colors.danger, icon: 'close-circle' }
      : { label: 'Available now', color: Theme.colors.success, icon: 'checkmark-circle' };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <View style={styles.handle} />

          <LinearGradient
            colors={Theme.gradients.passengerHero}
            style={styles.hero}>
            <View style={[styles.statusBadge, { backgroundColor: status.color + '22', borderColor: status.color + '55' }]}>
              <Ionicons name={status.icon} size={14} color={status.color} />
              <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
            </View>
            <Text style={styles.heroTitle}>{isActive ? 'Your ride' : 'Ride details'}</Text>
            {isActive && countdown ? (
              <Text style={styles.countdown}>Reservation · {countdown}</Text>
            ) : null}
          </LinearGradient>

          <ScrollView
            style={styles.body}
            contentContainerStyle={styles.bodyContent}
            showsVerticalScrollIndicator={false}
            bounces={false}>
            {/* Route timeline */}
            <View style={styles.routeCard}>
              <View style={styles.timeline}>
                <View style={styles.timelineCol}>
                  <View style={[styles.timelineDot, styles.dotFrom]} />
                  <View style={styles.timelineLine} />
                  <View style={[styles.timelineDot, styles.dotTo]} />
                </View>
                <View style={styles.timelineLabels}>
                  <View style={styles.timelineStop}>
                    <Text style={styles.stopLabel}>FROM</Text>
                    <Text style={styles.stopName}>{trip.originStation}</Text>
                  </View>
                  <View style={styles.timelineStop}>
                    <Text style={styles.stopLabel}>TO</Text>
                    <Text style={styles.stopName}>{trip.destination}</Text>
                  </View>
                </View>
              </View>
            </View>

            {/* Mate + vehicle */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>DRIVER & VEHICLE</Text>
              <View style={styles.mateCard}>
                <LinearGradient colors={Theme.gradients.buttonPassenger} style={styles.mateAvatar}>
                  <Ionicons name="person" size={28} color="#FFFFFF" />
                </LinearGradient>
                <View style={styles.mateInfo}>
                  <Text style={styles.mateName}>{trip.mateName ?? 'Your mate'}</Text>
                  {rating?.avg ? (
                    <View style={styles.ratingRow}>
                      <Ionicons name="star" size={14} color="#FBBF24" />
                      <Text style={styles.ratingText}>{rating.avg.toFixed(1)}</Text>
                      <Text style={styles.ratingCount}>({rating.count} ratings)</Text>
                    </View>
                  ) : (
                    <Text style={styles.ratingCount}>New on TrotroOS</Text>
                  )}
                  {trip.vehicleType ? (
                    <View style={styles.vehicleTypeRow}>
                      <Ionicons name={getVehicleIcon(trip.vehicleType)} size={14} color={Theme.colors.textSub} />
                      <Text style={styles.vehicleType}>{trip.vehicleType}</Text>
                    </View>
                  ) : null}
                </View>
                {trip.plate ? (
                  <View style={styles.plateBox}>
                    <Text style={styles.plateLabel}>PLATE</Text>
                    <Text style={styles.plateText}>{trip.plate}</Text>
                  </View>
                ) : null}
              </View>
            </View>

            {/* Trip info grid */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>TRIP INFO</Text>
              <View style={styles.infoGrid}>
                <DetailRow icon="cash-outline" label="Fare" value={`${trip.fare} · pay on board`} valueColor={Theme.colors.success} />
                <DetailRow
                  icon="time-outline"
                  label="Pickup ETA"
                  value={
                    isActive && driverLive
                      ? `Arriving in ${eta?.label ?? '…'}${distanceKm != null ? ` · ${formatDistance(distanceKm)}` : ''}`
                      : `Arrives in ${eta?.label ?? 'Estimating…'}${eta?.confidence === 'live' ? ' · live GPS' : ' · route estimate'}`
                  }
                  valueColor={Theme.colors.passenger}
                />
                <DetailRow
                  icon={getVehicleIcon(trip.vehicleType)}
                  label="Trip time"
                  value={`${tripDuration.label} from ${trip.originStation} to ${trip.destination}`}
                />
                <DetailRow
                  icon="people-outline"
                  label="Seats"
                  value={isFull ? 'Full — no seats left' : `${trip.availableSeats} seat${trip.availableSeats === 1 ? '' : 's'} available`}
                />
                <DetailRow icon="flash-outline" label="Status" value={trip.departureTime ?? 'Live now'} />
                {isActive && driverLive && distanceKm != null ? (
                  <DetailRow
                    icon="navigate-outline"
                    label="Distance"
                    value={formatDistance(distanceKm)}
                    valueColor={Theme.colors.passenger}
                  />
                ) : null}
                {isActive ? (
                  <DetailRow
                    icon="location-outline"
                    label="GPS"
                    value={driverLive ? 'Driver is broadcasting live location' : 'Waiting for driver GPS signal…'}
                    valueColor={driverLive ? Theme.colors.success : Theme.colors.gold}
                  />
                ) : null}
                <DetailRow icon="card-outline" label="Payment" value="Cash or MoMo to mate when you board" />
              </View>
            </View>
          </ScrollView>

          {/* Actions */}
          <View style={styles.actions}>
            {isActive ? (
              <>
                <PremiumButton
                  label="View on live map"
                  variant="passenger"
                  onPress={onTrackMap}
                  icon={<Ionicons name="map" size={20} color="#FFFFFF" />}
                />
                <Pressable onPress={onCancel} style={styles.cancelBtn}>
                  <Text style={styles.cancelBtnText}>Cancel reservation</Text>
                </Pressable>
              </>
            ) : (
              <>
                <PremiumButton
                  label={
                    isFull
                      ? 'Trip full'
                      : !reserveReady
                        ? 'Loading profile…'
                        : PASSENGER.reserveSheetCta
                  }
                  variant="passenger"
                  disabled={isFull || reserving || !reserveReady}
                  loading={reserving || !reserveReady}
                  onPress={onReserve}
                  icon={<Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />}
                />
                <Pressable onPress={onClose} style={styles.cancelBtn}>
                  <Text style={styles.cancelBtnText}>Close</Text>
                </Pressable>
              </>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: Theme.colors.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '88%',
    borderWidth: 1,
    borderColor: Theme.colors.borderStrong,
    ...glowShadow(Theme.colors.passenger, 0.15),
  },
  handle: {
    width: 44,
    height: 4,
    borderRadius: 2,
    backgroundColor: Theme.colors.borderStrong,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 4,
  },
  hero: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 20 },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Theme.radius.pill,
    borderWidth: 1,
    marginBottom: 10,
  },
  statusText: { fontSize: 12, fontWeight: '800', letterSpacing: 0.3 },
  heroTitle: { color: Theme.colors.text, fontSize: 26, fontWeight: '900', letterSpacing: -0.5 },
  countdown: { color: Theme.colors.gold, fontSize: 14, fontWeight: '700', marginTop: 6 },

  body: { flexGrow: 0, flexShrink: 1 },
  bodyContent: { paddingHorizontal: 20, paddingBottom: 8 },
  routeCard: {
    backgroundColor: Theme.colors.glass,
    borderRadius: Theme.radius.lg,
    padding: 16,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    marginBottom: 20,
  },
  timeline: { flexDirection: 'row', gap: 14 },
  timelineCol: { alignItems: 'center', paddingTop: 4 },
  timelineDot: { width: 12, height: 12, borderRadius: 6 },
  dotFrom: { backgroundColor: Theme.colors.success },
  dotTo: { backgroundColor: Theme.colors.passenger },
  timelineLine: { flex: 1, width: 2, backgroundColor: Theme.colors.border, marginVertical: 4, minHeight: 36 },
  timelineLabels: { flex: 1, justifyContent: 'space-between', gap: 20 },
  timelineStop: {},
  stopLabel: { color: Theme.colors.textMuted, fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  stopName: { color: Theme.colors.text, fontSize: 18, fontWeight: '800', marginTop: 2 },

  section: { marginBottom: 20 },
  sectionTitle: { color: Theme.colors.textMuted, fontSize: 11, fontWeight: '800', letterSpacing: 1, marginBottom: 10 },
  mateCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: Theme.colors.surfaceUp,
    borderRadius: Theme.radius.lg,
    padding: 16,
    borderWidth: 1,
    borderColor: Theme.colors.border,
  },
  mateAvatar: { width: 56, height: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  mateInfo: { flex: 1 },
  mateName: { color: Theme.colors.text, fontSize: 17, fontWeight: '800' },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  ratingText: { color: '#FBBF24', fontSize: 14, fontWeight: '800' },
  ratingCount: { color: Theme.colors.textMuted, fontSize: 12, fontWeight: '600', marginTop: 2 },
  vehicleType: { color: Theme.colors.textSub, fontSize: 13 },
  vehicleTypeRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  plateBox: {
    backgroundColor: Theme.colors.bg,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: Theme.colors.borderStrong,
    alignItems: 'center',
  },
  plateLabel: { color: Theme.colors.textMuted, fontSize: 9, fontWeight: '800', letterSpacing: 1 },
  plateText: {
    color: Theme.colors.text,
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 1.5,
    marginTop: 2,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },

  infoGrid: { gap: 4 },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Theme.colors.border,
  },
  detailIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: Theme.colors.passengerSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailText: { flex: 1 },
  detailLabel: { color: Theme.colors.textMuted, fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  detailValue: { color: Theme.colors.text, fontSize: 14, fontWeight: '600', marginTop: 2, lineHeight: 20 },

  actions: { paddingHorizontal: 20, paddingTop: 12, gap: 10 },
  cancelBtn: { alignItems: 'center', paddingVertical: 12 },
  cancelBtnText: { color: Theme.colors.textMuted, fontSize: 15, fontWeight: '700' },
});
