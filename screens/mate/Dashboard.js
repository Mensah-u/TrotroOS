import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  AppState,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import LivePulse from '@/components/LivePulse';
import SafeMapView, { canUseNativeMap, SafeCallout, SafeMarker, SafePolyline } from '@/components/SafeMapView';
import PulsingMapMarker from '@/components/PulsingMapMarker';
import MapClusterMarker from '@/components/MapClusterMarker';
import useViewportClusters from '@/hooks/useViewportClusters';
import { regionForCluster } from '@/utils/clustering';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  DEFAULT_MAP_REGION,
  findRouteById,
  findRouteIdByLabel,
  formatRoute,
  getAllPlaces,
  getPlaceCoords,
  getRouteFare,
  routes,
} from '@/constants/routes';
import { boardReservation } from '@/services/featuresV14';
import { getMateEarningsTotal, recordTripEarnings } from '@/services/mateEarnings';
import {
  getCustomRoutes,
  removeCustomRoute,
  saveCustomRoute,
} from '@/services/mateCustomRoutes';
import {
  createTrip,
  deleteDriverLocation,
  endTrip as endTripDb,
  fetchMateTripReservations,
  fetchPassengerLocations,
  fetchTripById,
  getActiveMateTrip,
  subscribeToPassengerLocations,
  subscribeToReservations,
  subscribeToTripById,
  updateTripDestination,
  updateTripFare,
  updateTripSeats,
  upsertDriverLocation,
  supabase,
} from '@/services/supabase';
import { TAB_FOOTER_CLEARANCE } from '@/constants/layout';
import { DEFAULT_VEHICLE_TYPE, getSeatLimitsForVehicleType } from '@/constants/vehicleTypes';
import { getSeatStatus, Theme } from '@/constants/theme';
import { formatSupabaseError } from '@/utils/supabaseErrors';
import { getMyLocationLabel } from '@/utils/myLocation';
import {
  buildDemandFromLocations,
  shortenRouteLabel,
  topDemandRoute,
  totalDemandCount,
} from '@/utils/passengerDemand';
import { passengerMatchesRoute } from '@/utils/routeMatching';

const C = {
  BG:          Theme.colors.bg,
  SURFACE:     Theme.colors.surface,
  SURFACE_UP:  Theme.colors.surfaceUp,
  BORDER:      Theme.colors.border,
  ACCENT:      Theme.colors.mate,
  ACCENT_SOFT: Theme.colors.mateSoft,
  MATE_MAP:    Theme.colors.mateMap,
  PASSENGER_MAP: Theme.colors.passengerMap,
  SUCCESS:     Theme.colors.success,
  WARN:        Theme.colors.seatFilling,
  DANGER:      Theme.colors.error,
  TEXT:        Theme.colors.text,
  TEXT_SUB:    Theme.colors.textSub,
  TEXT_MUTED:  Theme.colors.textMuted,
};

const MAP_INITIAL_REGION = DEFAULT_MAP_REGION;

const darkMapStyle = [
  { elementType: 'geometry',           stylers: [{ color: '#121212' }] },
  { elementType: 'labels.text.fill',   stylers: [{ color: '#6b7280' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#121212' }] },
  { featureType: 'administrative',     elementType: 'geometry.stroke', stylers: [{ color: '#1e1e1e' }] },
  { featureType: 'poi',                elementType: 'labels',          stylers: [{ visibility: 'off' }] },
  { featureType: 'road',               elementType: 'geometry',        stylers: [{ color: '#1e1e1e' }] },
  { featureType: 'road.highway',       elementType: 'geometry',        stylers: [{ color: '#1E1E1E' }] },
  { featureType: 'transit',            elementType: 'labels',          stylers: [{ visibility: 'off' }] },
  { featureType: 'water',              elementType: 'geometry',        stylers: [{ color: '#060606' }] },
];

function getSeatColor(seats) {
  return getSeatStatus(seats).color;
}

function filterPassengersForRoute(passengers, routeLabel) {
  if (!routeLabel) return passengers;
  return passengers.filter((p) => passengerMatchesRoute(p, routeLabel));
}

function formatGhs(amount) {
  return `GHS ${Number(amount).toFixed(2)}`;
}

const LIVE_POLL_MS = 5000;

function applyTripRowFromDb(current, row) {
  if (!current || current.tripId !== row.id) return current;
  const nextRoute = current.route
    ? {
        ...current.route,
        origin: row.origin ?? current.route.origin,
        destination: row.destination ?? current.route.destination,
      }
    : current.route;
  return {
    ...current,
    seatsLeft: row.available_seats ?? current.seatsLeft,
    totalSeats: row.total_seats ?? current.totalSeats,
    route: nextRoute,
  };
}

function routeFareGhs(route, persistedFare) {
  if (persistedFare != null && Number(persistedFare) > 0) return Number(persistedFare);
  if (route?.fareGhs != null && Number(route.fareGhs) > 0) return Number(route.fareGhs);
  return getRouteFare(route);
}

function formatElapsed(ms) {
  const sec = Math.floor(ms / 1000);
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (m >= 60) {
    const h = Math.floor(m / 60);
    return `${h}h ${m % 60}m`;
  }
  return `${m}:${String(s).padStart(2, '0')}`;
}

function formatReservationCountdown(expiresAt) {
  if (!expiresAt) return '';
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return 'Expired';
  const mins = Math.ceil(ms / 60000);
  return mins <= 1 ? '<1 min left' : `${mins} min left`;
}

function ReservationsPanel({ reservations, onBoard }) {
  if (!reservations?.length) return null;

  return (
    <View style={styles.reservationPanel}>
      <View style={styles.reservationPanelHeader}>
        <Ionicons name="bookmark" size={16} color={C.ACCENT} />
        <Text style={styles.reservationPanelTitle}>
          {reservations.length} reserved — tap to board
        </Text>
      </View>
      <ScrollView
        style={styles.reservationPanelScroll}
        contentContainerStyle={styles.reservationPanelScrollContent}
        nestedScrollEnabled
        showsVerticalScrollIndicator={false}>
        {reservations.map((r) => (
          <Pressable
            key={r.id}
            onPress={() => onBoard?.(r.id)}
            style={({ pressed }) => [styles.reservationRow, pressed && { opacity: 0.85 }]}>
            <Ionicons name="ticket-outline" size={15} color={C.ACCENT} />
            <View style={styles.reservationRowBody}>
              <Text style={styles.reservationRowText} numberOfLines={1}>
                Passenger {r.passenger_id?.slice(0, 8) ?? 'reserved'}
              </Text>
              <Text style={styles.reservationRowSub}>
                {formatReservationCountdown(r.expires_at)}
              </Text>
            </View>
            <Text style={styles.reservationBoardBtn}>Board</Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

// ─── Reservation banner ──────────────────────────────────────────────────────
function ReservationBanner({ visible }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-20)).current;

  useEffect(() => {
    if (visible) {
      Animated.sequence([
        Animated.parallel([
          Animated.timing(opacity,     { toValue: 1, duration: 300, useNativeDriver: true }),
          Animated.timing(translateY,  { toValue: 0, duration: 300, useNativeDriver: true }),
        ]),
        Animated.delay(2200),
        Animated.parallel([
          Animated.timing(opacity,     { toValue: 0, duration: 400, useNativeDriver: true }),
          Animated.timing(translateY,  { toValue: -20, duration: 400, useNativeDriver: true }),
        ]),
      ]).start();
    }
  }, [visible, opacity, translateY]);

  return (
    <Animated.View style={[styles.banner, { opacity, transform: [{ translateY }] }]} pointerEvents="none">
      <Ionicons name="checkmark-circle" size={18} color="#FFFFFF" />
      <Text style={styles.bannerText}>New seat reserved!</Text>
    </Animated.View>
  );
}

// ─── Sub-views ───────────────────────────────────────────────────────────────
function IdleView({ onStart, onStartWithDestination, onOpenEarn, demand, earningsTotal, lastSyncAt, defaultRouteLabel }) {
  const [, setUiTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setUiTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const demandEntries = Object.entries(demand ?? {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);
  const totalDemand = totalDemandCount(demand);
  const topRoute = topDemandRoute(demand);
  const syncSecs = lastSyncAt != null ? Math.max(0, Math.floor((Date.now() - lastSyncAt) / 1000)) : null;
  const syncLive = syncSecs != null && syncSecs < 12;

  const statCards = [
    topRoute
      ? {
          icon: 'flame-outline',
          label: `${topRoute[1]} waiting`,
          sub: shortenRouteLabel(topRoute[0]),
          live: true,
        }
      : defaultRouteLabel
        ? {
            icon: 'map-outline',
            label: 'Your route',
            sub: shortenRouteLabel(defaultRouteLabel),
            live: false,
          }
        : {
            icon: 'map-outline',
            label: `${routes.length} routes`,
            sub: 'Kumasi network',
            live: false,
          },
    {
      icon: 'people-outline',
      label: totalDemand > 0 ? `${totalDemand} in queue` : 'No queue yet',
      sub: totalDemand > 0
        ? `${demandEntries.length} route${demandEntries.length === 1 ? '' : 's'} with riders`
        : syncSecs != null
          ? 'Listening for passengers…'
          : 'Connecting to live feed…',
      live: totalDemand > 0,
    },
    {
      icon: syncLive ? 'flash' : 'flash-outline',
      label: syncSecs == null ? 'Connecting…' : syncLive ? 'Live sync' : `Synced ${syncSecs}s ago`,
      sub: syncLive ? 'Realtime active' : `Poll every ${LIVE_POLL_MS / 1000}s`,
      live: syncLive,
    },
  ];

  return (
    <View style={styles.idleWrap}>
    <ScrollView
      style={styles.flex1}
      contentContainerStyle={styles.idleScroll}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled">
      <View style={styles.idleCard}>
        <View style={styles.idleIconRing}>
          <Ionicons name="bus-outline" size={44} color={C.TEXT_MUTED} />
        </View>
        <Text style={styles.idleTitle}>No active trip</Text>
        <Text style={styles.idleSub}>Start a new trip to let passengers find you on the map.</Text>
      </View>

      <Pressable
        accessibilityRole="button"
        onPress={onStartWithDestination ?? onStart}
        style={({ pressed }) => [styles.destinationCard, pressed && { opacity: 0.9 }]}>
        <View style={styles.destinationIcon}>
          <Ionicons name="navigate" size={22} color={C.ACCENT} />
        </View>
        <View style={styles.destinationText}>
          <Text style={styles.destinationLabel}>Where are you going?</Text>
          <Text style={styles.destinationSub}>
            {defaultRouteLabel
              ? `Tap to depart on ${shortenRouteLabel(defaultRouteLabel, 32)}, or pick another route`
              : 'Type your route or pick a popular one — passengers see it instantly'}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={C.ACCENT} />
      </Pressable>

      {/* Live demand panel */}
      {totalDemand > 0 ? (
        <View style={styles.demandPanel}>
          <View style={styles.demandHeader}>
            <View style={styles.demandHeaderLeft}>
              <Ionicons name="trending-up" size={16} color="#FBBF24" />
              <Text style={styles.demandHeaderText}>Live demand</Text>
            </View>
            <View style={styles.demandHeaderBadge}>
              <Text style={styles.demandHeaderBadgeText}>{totalDemand} waiting</Text>
            </View>
          </View>
          <View style={styles.demandList}>
            {demandEntries.map(([route, count]) => (
              <View key={route} style={styles.demandRow}>
                <Text style={styles.demandRoute} numberOfLines={1}>{route}</Text>
                <View style={styles.demandCount}>
                  <Ionicons name="people" size={12} color="#FBBF24" />
                  <Text style={styles.demandCountText}>{count}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>
      ) : (
        <View style={styles.idleStatsRow}>
          {statCards.map((stat) => (
            <View key={stat.label} style={styles.statCard}>
              <View style={styles.statCardTop}>
                {stat.live ? <LivePulse color={C.ACCENT} size={5} /> : null}
                <Ionicons name={stat.icon} size={20} color={stat.live ? C.ACCENT : C.TEXT_SUB} />
              </View>
              <Text style={[styles.statLabel, stat.live && styles.statLabelLive]}>{stat.label}</Text>
              <Text style={styles.statSub}>{stat.sub}</Text>
            </View>
          ))}
        </View>
      )}

      <Pressable
        accessibilityRole="button"
        onPress={onOpenEarn}
        style={({ pressed }) => [styles.earnCard, pressed && { opacity: 0.88 }]}>
        <View style={styles.earnCardLeft}>
          <View style={styles.earnIcon}>
            <Ionicons name="wallet-outline" size={22} color={C.ACCENT} />
          </View>
          <View style={styles.earnText}>
            <Text style={styles.earnTitle}>Earn with TrotroOS</Text>
            <Text style={styles.earnSub}>Track fares · {formatGhs(earningsTotal)} total</Text>
          </View>
        </View>
        <Ionicons name="chevron-forward" size={20} color={C.TEXT_MUTED} />
      </Pressable>
    </ScrollView>

      <View style={styles.idleFooter}>
        <Pressable
          accessibilityRole="button"
          onPress={onStart}
          style={({ pressed }) => [styles.startButton, pressed && { opacity: 0.85 }]}>
          <Ionicons name="play" size={20} color="#FFFFFF" />
          <Text style={styles.startButtonText}>Start New Trip</Text>
        </Pressable>
      </View>
    </View>
  );
}

function CustomRouteEditor({ onSave, onCancel, mateCoords }) {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [fare, setFare] = useState('');
  const [locating, setLocating] = useState(null); // 'from' | 'to' | null
  const places = getAllPlaces();

  const pickMyLocation = async (field) => {
    if (locating) return;
    setLocating(field);
    try {
      const res = await getMyLocationLabel({ existingCoords: mateCoords });
      if (!res.ok) {
        Alert.alert(
          'Can\u2019t use your location',
          res.error === 'Location permission denied'
            ? 'Allow location access in Settings to use this feature.'
            : 'We couldn\u2019t pick up your GPS right now. Try again or type your spot.',
        );
        return;
      }
      if (field === 'from') setFrom(res.label);
      else setTo(res.label);
    } finally {
      setLocating(null);
    }
  };

  const submit = async () => {
    if (!from.trim() || !to.trim()) {
      Alert.alert('Add both stops', 'Type where you are leaving from and where you are heading to.');
      return;
    }
    if (from.trim().toLowerCase() === to.trim().toLowerCase()) {
      Alert.alert('Different stops needed', 'Origin and destination should be different.');
      return;
    }
    const saved = await saveCustomRoute({
      origin: from,
      destination: to,
      fareGhs: fare ? Number(fare) : null,
    });
    if (saved) onSave(saved);
  };

  return (
    <View style={styles.customForm}>
      <Text style={styles.customFormTitle}>Type your route</Text>

      <View style={styles.customLabelRow}>
        <Text style={[styles.customLabel, { marginTop: 0, marginBottom: 0 }]}>FROM</Text>
        <Pressable
          onPress={() => pickMyLocation('from')}
          disabled={locating === 'from'}
          hitSlop={8}
          style={({ pressed }) => [styles.myLocChip, pressed && { opacity: 0.7 }]}>
          {locating === 'from' ? (
            <ActivityIndicator size="small" color={C.ACCENT} />
          ) : (
            <Ionicons name="locate" size={12} color={C.ACCENT} />
          )}
          <Text style={styles.myLocChipText}>My location</Text>
        </Pressable>
      </View>
      <TextInput
        value={from}
        onChangeText={setFrom}
        placeholder="e.g. Asafo Market"
        placeholderTextColor={C.TEXT_MUTED}
        style={styles.customInput}
        autoCapitalize="words"
        returnKeyType="next"
      />

      <View style={styles.customLabelRow}>
        <Text style={[styles.customLabel, { marginTop: 0, marginBottom: 0 }]}>TO</Text>
        <Pressable
          onPress={() => pickMyLocation('to')}
          disabled={locating === 'to'}
          hitSlop={8}
          style={({ pressed }) => [styles.myLocChip, pressed && { opacity: 0.7 }]}>
          {locating === 'to' ? (
            <ActivityIndicator size="small" color={C.ACCENT} />
          ) : (
            <Ionicons name="locate" size={12} color={C.ACCENT} />
          )}
          <Text style={styles.myLocChipText}>My location</Text>
        </Pressable>
      </View>
      <TextInput
        value={to}
        onChangeText={setTo}
        placeholder="e.g. Suame Magazine"
        placeholderTextColor={C.TEXT_MUTED}
        style={styles.customInput}
        autoCapitalize="words"
        returnKeyType="next"
      />

      <Text style={styles.customLabel}>FARE PER SEAT (GHS) · OPTIONAL</Text>
      <TextInput
        value={fare}
        onChangeText={(v) => setFare(v.replace(/[^0-9.]/g, ''))}
        placeholder="Defaults to 4"
        placeholderTextColor={C.TEXT_MUTED}
        style={styles.customInput}
        keyboardType="decimal-pad"
      />

      {places.length > 0 ? (
        <>
          <Text style={[styles.customLabel, { marginTop: 14 }]}>QUICK PICK</Text>
          <View style={styles.suggestionsRow}>
            {places.map((p) => (
              <Pressable
                key={p}
                onPress={() => {
                  if (!from.trim()) setFrom(p);
                  else if (!to.trim()) setTo(p);
                  else setTo(p);
                }}
                style={({ pressed }) => [styles.suggestionChip, pressed && { opacity: 0.7 }]}>
                <Ionicons name="location-outline" size={12} color={C.TEXT_SUB} />
                <Text style={styles.suggestionChipText}>{p}</Text>
              </Pressable>
            ))}
          </View>
        </>
      ) : null}

      <View style={styles.customActions}>
        <Pressable onPress={onCancel} style={({ pressed }) => [styles.customGhostBtn, pressed && { opacity: 0.7 }]}>
          <Text style={styles.customGhostText}>Cancel</Text>
        </Pressable>
        <Pressable onPress={submit} style={({ pressed }) => [styles.customPrimaryBtn, pressed && { opacity: 0.85 }]}>
          <Ionicons name="checkmark" size={16} color="#FFFFFF" />
          <Text style={styles.customPrimaryText}>Save & select</Text>
        </Pressable>
      </View>
    </View>
  );
}

function SetupView({ onDepart, onCancel, defaultRouteId, loading, demand, lastSyncAt, startWithCustomEditor = false, mateCoords = null, vehicleType = DEFAULT_VEHICLE_TYPE }) {
  const seatLimits = useMemo(() => getSeatLimitsForVehicleType(vehicleType), [vehicleType]);
  const [selectedRouteId, setSelectedRouteId] = useState(defaultRouteId ?? null);
  const [seats, setSeats] = useState(seatLimits.default);
  const [customRoutes, setCustomRoutes] = useState([]);
  const [editingCustom, setEditingCustom] = useState(!!startWithCustomEditor);

  const builtins = routes;
  const allRoutes = [...customRoutes, ...builtins];
  const selectedRoute = allRoutes.find((r) => r.id === selectedRouteId) ?? null;
  const canDepart = selectedRoute !== null && !loading;
  const estFare = selectedRoute ? getRouteFare(selectedRoute) * seats : 0;
  const selectedLabel = selectedRoute ? formatRoute(selectedRoute) : null;
  const waitingOnRoute = selectedLabel ? (demand?.[selectedLabel] ?? 0) : 0;
  const syncSecs = lastSyncAt != null ? Math.max(0, Math.floor((Date.now() - lastSyncAt) / 1000)) : null;
  const [, setUiTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setUiTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    getCustomRoutes().then(setCustomRoutes).catch(() => {});
  }, []);

  useEffect(() => {
    setSeats((current) =>
      Math.min(seatLimits.max, Math.max(seatLimits.min, current || seatLimits.default)),
    );
  }, [seatLimits.min, seatLimits.max, seatLimits.default]);

  useEffect(() => {
    if (defaultRouteId != null && selectedRouteId == null) setSelectedRouteId(defaultRouteId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultRouteId]);

  const handleSaveCustom = (saved) => {
    setCustomRoutes((list) => [saved, ...list.filter((r) => r.id !== saved.id)].slice(0, 8));
    setSelectedRouteId(saved.id);
    setEditingCustom(false);
  };

  const handleRemoveCustom = (id) => {
    Alert.alert('Remove saved route?', 'You can add it again anytime.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          const next = await removeCustomRoute(id);
          setCustomRoutes(next);
          if (selectedRouteId === id) setSelectedRouteId(null);
        },
      },
    ]);
  };

  const renderRouteRow = (route, { custom = false } = {}) => {
    const isSelected = route.id === selectedRouteId;
    return (
      <Pressable
        key={route.id}
        accessibilityRole="radio"
        accessibilityState={{ selected: isSelected }}
        onPress={() => setSelectedRouteId(route.id)}
        style={({ pressed }) => [
          styles.routeRow,
          isSelected && styles.routeRowSelected,
          pressed && { opacity: 0.8 },
        ]}>
        <View style={[styles.routeRadio, isSelected && styles.routeRadioSelected]}>
          {isSelected ? <View style={styles.routeRadioDot} /> : null}
        </View>
        <View style={styles.routeRowTextWrap}>
          <View style={styles.routeRowLabelRow}>
            <Text style={[styles.routeRowText, isSelected && styles.routeRowTextSelected]} numberOfLines={1}>
              {formatRoute(route)}
            </Text>
            {custom ? (
              <View style={styles.customBadge}>
                <Text style={styles.customBadgeText}>CUSTOM</Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.routeFareTag}>GHS {getRouteFare(route)}/passenger</Text>
        </View>
        {custom ? (
          <Pressable
            hitSlop={10}
            onPress={() => handleRemoveCustom(route.id)}
            style={styles.routeRemoveBtn}>
            <Ionicons name="close" size={14} color={C.TEXT_MUTED} />
          </Pressable>
        ) : null}
      </Pressable>
    );
  };

  return (
    <View style={styles.setupWrap}>
    <KeyboardAvoidingView
      style={styles.flex1}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <ScrollView style={styles.flex1} contentContainerStyle={styles.setupScroll} keyboardShouldPersistTaps="handled">
      <View style={styles.setupHeader}>
        <Pressable onPress={onCancel} hitSlop={12} style={styles.iconButton} disabled={loading}>
          <View style={styles.backButton}>
            <Ionicons name="chevron-back" size={20} color={loading ? C.TEXT_MUTED : C.TEXT} />
          </View>
        </Pressable>
        <Text style={styles.setupHeading}>New Trip</Text>
        <View style={styles.iconButton} />
      </View>

      <Text style={styles.sectionLabel}>WHERE ARE YOU GOING?</Text>
      {!editingCustom ? (
        <Pressable
          onPress={() => setEditingCustom(true)}
          style={({ pressed }) => [styles.addCustomBtnPrimary, pressed && { opacity: 0.9 }]}>
          <View style={styles.addCustomIcon}>
            <Ionicons name="navigate" size={20} color="#FFFFFF" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.addCustomTitle}>Type your destination</Text>
            <Text style={styles.addCustomSub}>Any route — your saved routes are below</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#FFFFFF" />
        </Pressable>
      ) : (
        <CustomRouteEditor
          onSave={handleSaveCustom}
          onCancel={() => setEditingCustom(false)}
          mateCoords={mateCoords}
        />
      )}

      {customRoutes.length > 0 ? (
        <>
          <Text style={styles.sectionLabel}>YOUR SAVED ROUTES</Text>
          <View style={styles.routeList}>
            {customRoutes.map((r) => renderRouteRow(r, { custom: true }))}
          </View>
        </>
      ) : null}

      <Text style={styles.sectionLabel}>POPULAR KUMASI ROUTES</Text>
      <View style={styles.routeList}>
        {builtins.map((route) => renderRouteRow(route))}
      </View>

      <Text style={styles.sectionLabel}>PASSENGER SEATS</Text>
      <Text style={styles.stepperSubLabel}>{vehicleType} · default {seatLimits.default} seats</Text>
      <View style={styles.stepperCard}>
        <Pressable
          accessibilityRole="button"
          disabled={seats <= seatLimits.min || loading}
          onPress={() => setSeats((s) => Math.max(seatLimits.min, s - 1))}
          style={({ pressed }) => [styles.stepperBtn, (seats <= seatLimits.min || loading) && styles.stepperBtnDisabled, pressed && { opacity: 0.7 }]}>
          <Ionicons name="remove" size={24} color={C.TEXT} />
        </Pressable>
        <View style={styles.stepperCenter}>
          <Text style={styles.stepperValue}>{seats}</Text>
          <Text style={styles.stepperHint}>seats</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          disabled={seats >= seatLimits.max || loading}
          onPress={() => setSeats((s) => Math.min(seatLimits.max, s + 1))}
          style={({ pressed }) => [styles.stepperBtn, (seats >= seatLimits.max || loading) && styles.stepperBtnDisabled, pressed && { opacity: 0.7 }]}>
          <Ionicons name="add" size={24} color={C.TEXT} />
        </Pressable>
      </View>

      {selectedRoute ? (
        <>
          <View style={styles.routeDemandRow}>
            <LivePulse color={waitingOnRoute > 0 ? '#FBBF24' : C.TEXT_MUTED} size={6} />
            <Text style={styles.routeDemandText}>
              {waitingOnRoute > 0
                ? `${waitingOnRoute} passenger${waitingOnRoute === 1 ? '' : 's'} waiting on this route`
                : 'No passengers in queue on this route yet'}
            </Text>
            {syncSecs != null ? (
              <Text style={styles.routeDemandSync}>· live {syncSecs}s ago</Text>
            ) : null}
          </View>
          <View style={styles.estEarningsRow}>
            <Ionicons name="cash-outline" size={16} color={C.SUCCESS} />
            <Text style={styles.estEarningsText}>
              Full trip potential: {formatGhs(estFare)}
            </Text>
          </View>
        </>
      ) : null}
    </ScrollView>
    </KeyboardAvoidingView>

      <View style={styles.setupFooter}>
        <Pressable
          accessibilityRole="button"
          disabled={!canDepart}
          onPress={() => {
            if (!selectedRoute) return;
            const routeForDepart = {
              ...selectedRoute,
              mapCenter:
                selectedRoute.mapCenter ??
                getPlaceCoords(selectedRoute.origin) ??
                getPlaceCoords(selectedRoute.destination) ??
                DEFAULT_MAP_REGION,
            };
            onDepart({ route: routeForDepart, totalSeats: seats });
          }}
          style={({ pressed }) => [
            styles.departButton,
            !canDepart && styles.departButtonDisabled,
            pressed && canDepart && { opacity: 0.85 },
          ]}>
          {loading ? (
            <Text style={styles.departButtonText}>Starting trip…</Text>
          ) : (
            <>
              <Ionicons name="navigate" size={18} color={canDepart ? '#FFFFFF' : C.TEXT_MUTED} />
              <Text style={styles.departButtonText}>Depart Now</Text>
            </>
          )}
        </Pressable>
      </View>
    </View>
  );
}

function ActiveView({
  trip,
  onOnboard,
  onBoardReservation,
  onTripFull,
  onEndTrip,
  onOpenEarn,
  onUpdateDestination,
  reservationBannerKey,
  reservationCount,
  tripReservations,
  mateCoords,
  passengerLocations,
  lastSyncAt,
}) {
  const isFull = trip.seatsLeft === 0;
  const seatColor = getSeatColor(trip.seatsLeft);
  const [showMap, setShowMap] = useState(true);
  const [elapsed, setElapsed] = useState('0:00');
  const [editingDest, setEditingDest] = useState(false);
  const [editFrom, setEditFrom] = useState(trip.route?.origin ?? '');
  const [editTo, setEditTo] = useState(trip.route?.destination ?? '');
  const [savingDest, setSavingDest] = useState(false);
  const [editLocating, setEditLocating] = useState(null);

  const pickEditMyLocation = async (field) => {
    if (editLocating) return;
    setEditLocating(field);
    try {
      const res = await getMyLocationLabel({ existingCoords: mateCoords });
      if (!res.ok) {
        Alert.alert(
          'Can\u2019t use your location',
          res.error === 'Location permission denied'
            ? 'Allow location access in Settings to use this feature.'
            : 'We couldn\u2019t pick up your GPS right now. Try again or type your spot.',
        );
        return;
      }
      if (field === 'from') setEditFrom(res.label);
      else setEditTo(res.label);
    } finally {
      setEditLocating(null);
    }
  };
  const mapRef = useRef(null);
  const routeLabel = formatRoute(trip.route);
  const routePassengers = filterPassengersForRoute(passengerLocations, routeLabel);
  const tripEarnings = trip.passengersOnboarded * getRouteFare(trip.route);
  const gpsLive = trip.locationStatus === 'active' && !!mateCoords;
  const [, setUiTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setUiTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!trip.startedAt) return;
    const tick = () => setElapsed(formatElapsed(Date.now() - new Date(trip.startedAt).getTime()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [trip.startedAt]);

  useEffect(() => {
    setEditFrom(trip.route?.origin ?? '');
    setEditTo(trip.route?.destination ?? '');
  }, [trip.route?.origin, trip.route?.destination]);

  const openDestEdit = () => {
    setEditFrom(trip.route?.origin ?? '');
    setEditTo(trip.route?.destination ?? '');
    setEditingDest(true);
  };

  const saveDestEdit = async () => {
    const from = editFrom.trim();
    const to = editTo.trim();
    if (!from || !to) {
      Alert.alert('Both stops needed', 'Please type a from and a to.');
      return;
    }
    if (from === trip.route?.origin && to === trip.route?.destination) {
      setEditingDest(false);
      return;
    }
    setSavingDest(true);
    try {
      await onUpdateDestination?.({ origin: from, destination: to });
      setEditingDest(false);
    } finally {
      setSavingDest(false);
    }
  };
  const originCoords    = getPlaceCoords(trip.route?.origin);
  const destCoords      = getPlaceCoords(trip.route?.destination);
  const tripRoutePoints = useMemo(
    () => [originCoords, mateCoords, destCoords].filter(Boolean),
    [originCoords, mateCoords, destCoords],
  );

  const mapRegion = mateCoords
    ? { ...mateCoords, latitudeDelta: 0.025, longitudeDelta: 0.025 }
    : (trip.route?.mapCenter
      ? { ...trip.route.mapCenter, latitudeDelta: 0.04, longitudeDelta: 0.04 }
      : MAP_INITIAL_REGION);

  // Cluster waiting/reserved passengers based on what's actually visible.
  const passengerMarkerInputs = useMemo(
    () =>
      routePassengers
        .filter((p) => p.latitude != null && p.longitude != null)
        .map((p) => ({
          id: p.passenger_id,
          latitude: p.latitude,
          longitude: p.longitude,
          data: p,
        })),
    [routePassengers],
  );

  const {
    onRegionChange: onMapRegionChange,
    onLayout: onMapLayout,
    clusters: passengerClusters,
  } = useViewportClusters(passengerMarkerInputs, {
    initialRegion: mapRegion,
    gridSizePx: 64,
    minPoints: 3,
  });

  const onPassengerClusterPress = useCallback((cluster) => {
    if (!canUseNativeMap() || !mapRef.current) return;
    const next = regionForCluster(cluster);
    if (next) mapRef.current.animateToRegion(next, 350);
  }, []);

  useEffect(() => {
    if (!canUseNativeMap() || !showMap || !mapRef.current || !mateCoords) return;
    mapRef.current.animateToRegion(
      { ...mateCoords, latitudeDelta: 0.02, longitudeDelta: 0.02 },
      450,
    );
  }, [mateCoords, showMap]);

  useEffect(() => {
    if (!canUseNativeMap() || !showMap || !mapRef.current) return;
    if (tripRoutePoints.length >= 2) {
      mapRef.current.fitToCoordinates(tripRoutePoints, {
        edgePadding: { top: 80, right: 60, bottom: 120, left: 60 },
        animated: true,
      });
    }
  }, [showMap, tripRoutePoints]);

  return (
    <View style={styles.activeContainer}>
      <ReservationBanner key={reservationBannerKey} visible={reservationBannerKey > 0} />

      {/* Trip card */}
      <View style={styles.activeTripCard}>
        <View style={styles.activeTripTop}>
          <View style={styles.activeTripInfo}>
            <View style={styles.activeRouteHeader}>
              <Text style={styles.activeRouteLabel}>ACTIVE ROUTE</Text>
              <Pressable
                onPress={openDestEdit}
                hitSlop={10}
                style={({ pressed }) => [styles.editDestBtn, pressed && { opacity: 0.7 }]}>
                <Ionicons name="create-outline" size={12} color={C.ACCENT} />
                <Text style={styles.editDestBtnText}>Edit</Text>
              </Pressable>
            </View>
            <Text style={styles.activeRoute} numberOfLines={2}>{formatRoute(trip.route)}</Text>
          </View>
          <View style={[styles.seatCircle, { borderColor: seatColor }]}>
            <Text style={[styles.seatCircleNum, { color: seatColor }]}>{isFull ? '0' : trip.seatsLeft}</Text>
            <Text style={styles.seatCircleLabel}>left</Text>
          </View>
        </View>

        {editingDest ? (
          <View style={styles.destEditBox}>
            <Text style={styles.destEditTitle}>Change where you&apos;re going</Text>
            <View style={styles.customLabelRow}>
              <Text style={[styles.customLabel, { marginTop: 0, marginBottom: 0 }]}>FROM</Text>
              <Pressable
                onPress={() => pickEditMyLocation('from')}
                disabled={editLocating === 'from'}
                hitSlop={8}
                style={({ pressed }) => [styles.myLocChip, pressed && { opacity: 0.7 }]}>
                {editLocating === 'from' ? (
                  <ActivityIndicator size="small" color={C.ACCENT} />
                ) : (
                  <Ionicons name="locate" size={12} color={C.ACCENT} />
                )}
                <Text style={styles.myLocChipText}>My location</Text>
              </Pressable>
            </View>
            <TextInput
              value={editFrom}
              onChangeText={setEditFrom}
              placeholder="Origin"
              placeholderTextColor={C.TEXT_MUTED}
              style={styles.customInput}
              autoCapitalize="words"
            />
            <View style={styles.customLabelRow}>
              <Text style={[styles.customLabel, { marginTop: 0, marginBottom: 0 }]}>TO</Text>
              <Pressable
                onPress={() => pickEditMyLocation('to')}
                disabled={editLocating === 'to'}
                hitSlop={8}
                style={({ pressed }) => [styles.myLocChip, pressed && { opacity: 0.7 }]}>
                {editLocating === 'to' ? (
                  <ActivityIndicator size="small" color={C.ACCENT} />
                ) : (
                  <Ionicons name="locate" size={12} color={C.ACCENT} />
                )}
                <Text style={styles.myLocChipText}>My location</Text>
              </Pressable>
            </View>
            <TextInput
              value={editTo}
              onChangeText={setEditTo}
              placeholder="Destination"
              placeholderTextColor={C.TEXT_MUTED}
              style={styles.customInput}
              autoCapitalize="words"
            />
            <View style={styles.destEditActions}>
              <Pressable
                onPress={() => setEditingDest(false)}
                disabled={savingDest}
                style={({ pressed }) => [styles.customGhostBtn, pressed && { opacity: 0.7 }]}>
                <Text style={styles.customGhostText}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={saveDestEdit}
                disabled={savingDest}
                style={({ pressed }) => [styles.customPrimaryBtn, pressed && { opacity: 0.85 }, savingDest && { opacity: 0.6 }]}>
                <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                <Text style={styles.customPrimaryText}>{savingDest ? 'Saving…' : 'Update'}</Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        <View style={styles.liveStatsRow}>
          <View style={styles.liveStatPill}>
            <LivePulse color="#FBBF24" size={6} />
            <Text style={styles.liveStatText}>{routePassengers.length} waiting</Text>
          </View>
          <View style={[styles.liveStatPill, reservationCount > 0 && styles.liveStatPillReserved]}>
            <LivePulse color={reservationCount > 0 ? C.ACCENT : C.ACCENT} size={6} />
            <Text style={[styles.liveStatText, reservationCount > 0 && styles.liveStatTextReserved]}>
              {reservationCount} reserved
            </Text>
          </View>
          <View style={styles.liveStatPill}>
            <Ionicons name="time-outline" size={13} color={C.TEXT_SUB} />
            <Text style={styles.liveStatText}>{elapsed}</Text>
          </View>
          <Pressable onPress={onOpenEarn} style={styles.liveStatPill}>
            <Ionicons name="wallet-outline" size={13} color={C.SUCCESS} />
            <Text style={[styles.liveStatText, { color: C.SUCCESS }]}>{formatGhs(tripEarnings)}</Text>
          </Pressable>
        </View>

        <View style={styles.activeTripMeta}>
          <View style={styles.metaLeft}>
            <View style={styles.locationBadge}>
              {gpsLive ? <LivePulse color={C.SUCCESS} size={7} /> : (
                <View style={[styles.locationDot, trip.locationStatus === 'active' && styles.locationDotActive]} />
              )}
              <Text style={[styles.locationBadgeText, gpsLive && { color: '#86efac' }]}>
                {gpsLive ? 'Live GPS' : trip.locationStatus === 'active' ? 'Syncing GPS…' : 'Locating…'}
              </Text>
            </View>
            {lastSyncAt ? (
              <Text style={styles.syncHint}>
                Live · updated {Math.max(0, Math.floor((Date.now() - lastSyncAt) / 1000))}s ago
              </Text>
            ) : null}
          </View>
          <Pressable
            onPress={() => setShowMap((s) => !s)}
            style={({ pressed }) => [styles.mapToggle, showMap && styles.mapToggleOn, pressed && { opacity: 0.8 }]}>
            <Ionicons name={showMap ? 'grid-outline' : 'map-outline'} size={15} color={showMap ? C.ACCENT : C.TEXT_SUB} />
            <Text style={[styles.mapToggleText, showMap && { color: C.ACCENT }]}>
              {showMap ? 'Controls' : 'Live Map'}
            </Text>
          </Pressable>
        </View>
      </View>

      <ReservationsPanel reservations={tripReservations} onBoard={onBoardReservation} />

      {/* Map or big buttons */}
      {showMap ? (
        <View style={styles.mateMapWrapper}>
          <SafeMapView
            ref={mapRef}
            style={StyleSheet.absoluteFill}
            initialRegion={mapRegion}
            customMapStyle={darkMapStyle}
            showsCompass={false}
            showsUserLocation={false}
            followsUserLocation={false}
            onLayout={onMapLayout}
            onRegionChangeComplete={onMapRegionChange}
            fallbackMessage="Live map needs a Google Maps key in release builds. Controls below still work.">
            {originCoords ? (
              <SafeMarker
                coordinate={originCoords}
                anchor={{ x: 0.5, y: 1 }}
                tracksViewChanges={false}
                zIndex={3}>
                <View style={styles.tripPinWrap}>
                  <View style={[styles.tripPin, styles.tripPinOrigin]}>
                    <Ionicons name="flag" size={14} color="#FFFFFF" />
                  </View>
                  <View style={styles.tripPinLabel}>
                    <Text style={styles.tripPinLabelText} numberOfLines={1}>
                      {trip.route?.origin}
                    </Text>
                  </View>
                  <View style={[styles.tripPinTail, styles.tripPinTailOrigin]} />
                </View>
                <SafeCallout tooltip>
                  <View style={styles.calloutCard}>
                    <Text style={styles.calloutTitle}>Pickup point</Text>
                    <Text style={styles.calloutSub}>{trip.route?.origin}</Text>
                  </View>
                </SafeCallout>
              </SafeMarker>
            ) : null}
            {destCoords ? (
              <SafeMarker
                coordinate={destCoords}
                anchor={{ x: 0.5, y: 1 }}
                tracksViewChanges={false}
                zIndex={3}>
                <View style={styles.tripPinWrap}>
                  <View style={[styles.tripPin, styles.tripPinDest]}>
                    <Ionicons name="location" size={14} color="#FFFFFF" />
                  </View>
                  <View style={styles.tripPinLabel}>
                    <Text style={styles.tripPinLabelText} numberOfLines={1}>
                      {trip.route?.destination}
                    </Text>
                  </View>
                  <View style={[styles.tripPinTail, styles.tripPinTailDest]} />
                </View>
                <SafeCallout tooltip>
                  <View style={styles.calloutCard}>
                    <Text style={styles.calloutTitle}>Destination</Text>
                    <Text style={styles.calloutSub}>{trip.route?.destination}</Text>
                  </View>
                </SafeCallout>
              </SafeMarker>
            ) : null}
            {tripRoutePoints.length >= 2 ? (
              <SafePolyline
                coordinates={tripRoutePoints}
                strokeColor={C.ACCENT}
                strokeWidth={4}
                lineDashPattern={[6, 6]}
                lineCap="round"
                zIndex={1}
              />
            ) : null}
            {mateCoords ? (
              <SafeMarker
                coordinate={mateCoords}
                anchor={{ x: 0.5, y: 0.5 }}
                tracksViewChanges
                zIndex={2}>
                <PulsingMapMarker
                  color={C.MATE_MAP}
                  size={44}
                  icon="bus"
                  label="YOU · LIVE"
                />
              </SafeMarker>
            ) : null}
            {passengerClusters.map((c) => {
              if (c.isCluster) {
                const reservedCount = c.markers.filter((m) => m.data?.reservation_id).length;
                return (
                  <SafeMarker
                    key={c.id}
                    coordinate={{ latitude: c.latitude, longitude: c.longitude }}
                    anchor={{ x: 0.5, y: 0.5 }}
                    tracksViewChanges={false}
                    zIndex={4}
                    onPress={() => onPassengerClusterPress(c)}>
                    <MapClusterMarker
                      count={c.count}
                      color={reservedCount > 0 ? C.ACCENT : C.PASSENGER_MAP}
                    />
                  </SafeMarker>
                );
              }
              const p = c.marker?.data;
              if (!p) return null;
              return (
                <SafeMarker
                  key={`${p.passenger_id}-${p.latitude}-${p.longitude}`}
                  coordinate={{ latitude: p.latitude, longitude: p.longitude }}
                  anchor={{ x: 0.5, y: 0.5 }}
                  tracksViewChanges>
                  <PulsingMapMarker
                    color={p.reservation_id ? C.ACCENT : C.PASSENGER_MAP}
                    size={32}
                    icon={p.reservation_id ? 'bookmark' : 'person'}
                    ringOpacity={p.reservation_id ? 0.55 : 0.4}
                    ringScaleTo={p.reservation_id ? 2.5 : 2.0}
                  />
                  <SafeCallout tooltip>
                    <View style={styles.calloutCard}>
                      <Text style={styles.calloutTitle}>{p.reservation_id ? 'Reserved passenger' : 'Waiting passenger'}</Text>
                      <Text style={styles.calloutSub}>{p.queued_route ?? routeLabel}</Text>
                    </View>
                  </SafeCallout>
                </SafeMarker>
              );
            })}
          </SafeMapView>
          {routePassengers.length === 0 ? (
            <View style={styles.mapEmptyOverlay} pointerEvents="none">
              <View style={styles.mapEmptyPill}>
                <Ionicons name="person-outline" size={13} color={C.TEXT_SUB} />
                <Text style={styles.mapEmptyText}>No waiting passengers</Text>
              </View>
            </View>
          ) : null}

          <View style={styles.mapLegend} pointerEvents="none">
            <View style={styles.mapLegendRow}>
              <View style={[styles.mapLegendDot, { backgroundColor: C.SUCCESS }]} />
              <Text style={styles.mapLegendText} numberOfLines={1}>
                {trip.route?.origin ?? 'Pickup'}
              </Text>
            </View>
            <View style={styles.mapLegendRow}>
              <View style={[styles.mapLegendDot, { backgroundColor: C.MATE_MAP }]} />
              <Text style={styles.mapLegendText}>You</Text>
            </View>
            <View style={styles.mapLegendRow}>
              <View style={[styles.mapLegendDot, { backgroundColor: C.ACCENT }]} />
              <Text style={styles.mapLegendText}>Reserved seat</Text>
            </View>
            <View style={styles.mapLegendRow}>
              <View style={[styles.mapLegendDot, { backgroundColor: C.PASSENGER_MAP }]} />
              <Text style={styles.mapLegendText}>Waiting</Text>
            </View>
          </View>
        </View>
      ) : (
        <View style={styles.activeBody}>
          <Pressable
            accessibilityRole="button"
            disabled={isFull}
            onPress={onOnboard}
            style={({ pressed }) => [styles.onboardButton, isFull && styles.onboardButtonFull, pressed && !isFull && { opacity: 0.88 }]}>
            <View style={styles.onboardButtonInner}>
              {isFull ? (
                <Ionicons name="ban-outline" size={32} color="rgba(255,255,255,0.5)" />
              ) : (
                <Ionicons name="person-add" size={32} color="#FFFFFF" />
              )}
              <Text style={styles.onboardButtonText}>{isFull ? 'TRIP FULL' : '+1 WALK-UP'}</Text>
              {!isFull ? <Text style={styles.onboardButtonSub}>passenger without reservation</Text> : null}
            </View>
          </Pressable>
        </View>
      )}

      {!showMap ? (
        <View style={styles.activeFooter}>
          <View style={styles.activeSecondaryRow}>
            <Pressable
              disabled={isFull}
              onPress={onTripFull}
              style={({ pressed }) => [styles.fullButton, isFull && { opacity: 0.4 }, pressed && { opacity: 0.75 }]}>
              <Ionicons name="close-circle-outline" size={18} color={C.ACCENT} />
              <Text style={styles.fullButtonText}>Mark Full</Text>
            </Pressable>

            <Pressable
              onPress={onEndTrip}
              style={({ pressed }) => [styles.endButton, pressed && { opacity: 0.75 }]}>
              <Ionicons name="flag-outline" size={18} color={C.TEXT_MUTED} />
              <Text style={styles.endButtonText}>End Trip</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </View>
  );
}

// ─── Main Dashboard ──────────────────────────────────────────────────────────
export default function Dashboard({ profile, mateId: mateIdProp, onOpenProfile, onOpenEarn }) {
  const mateId = mateIdProp ?? profile?.id;
  const [mode, setMode] = useState('idle');
  const [trip, setTrip] = useState(null);
  const [departLoading, setDepartLoading] = useState(false);
  const [reservationBannerKey, setReservationBannerKey] = useState(0);
  const [reservationCount, setReservationCount] = useState(0);
  const [tripReservations, setTripReservations] = useState([]);
  const [mateCoords, setMateCoords] = useState(null);
  const mateCoordsRef = useRef(null);
  useEffect(() => { mateCoordsRef.current = mateCoords; }, [mateCoords]);
  const [passengerLocations, setPassengerLocations] = useState([]);
  const [idleDemand, setIdleDemand] = useState({});
  const [earningsTotal, setEarningsTotal] = useState(0);
  const [lastSyncAt, setLastSyncAt] = useState(null);

  const locationSubRef = useRef(null);
  const reservationSubRef = useRef(null);
  const passengerSubRef = useRef(null);
  const idleDemandSubRef = useRef(null);
  const tripSubRef = useRef(null);
  const tripRef = useRef(trip);
  const restoredTripRef = useRef(false);
  useEffect(() => { tripRef.current = trip; }, [trip]);

  useEffect(() => {
    getMateEarningsTotal().then(setEarningsTotal).catch(() => {});
  }, []);

  // ─── Passenger locations subscription ─────────────────────────────────────
  const startPassengerSubscription = useCallback(() => {
    if (passengerSubRef.current) supabase.removeChannel(passengerSubRef.current);
    const ch = subscribeToPassengerLocations((locs) => {
      setPassengerLocations(locs);
      setLastSyncAt(Date.now());
    }, { centerRef: mateCoordsRef, radiusKm: 8 });
    passengerSubRef.current = ch;
  }, []);

  const stopPassengerSubscription = useCallback(() => {
    if (passengerSubRef.current) {
      supabase.removeChannel(passengerSubRef.current);
      passengerSubRef.current = null;
    }
    setPassengerLocations([]);
  }, []);

  const applyPassengerLocations = useCallback((locs) => {
    setIdleDemand(buildDemandFromLocations(locs));
    setPassengerLocations(locs);
    setLastSyncAt(Date.now());
  }, []);

  // Live demand while idle/setup: Realtime + poll fallback.
  useEffect(() => {
    if (mode !== 'idle' && mode !== 'setup') {
      if (idleDemandSubRef.current) {
        supabase.removeChannel(idleDemandSubRef.current);
        idleDemandSubRef.current = null;
      }
      return undefined;
    }

    const refresh = () => {
      fetchPassengerLocations()
        .then(({ data, error }) => {
          if (!error) applyPassengerLocations(data ?? []);
        })
        .catch(() => {});
    };

    refresh();
    const ch = subscribeToPassengerLocations(applyPassengerLocations, { radiusKm: 8 });
    idleDemandSubRef.current = ch;
    const pollId = setInterval(refresh, LIVE_POLL_MS);

    return () => {
      clearInterval(pollId);
      if (ch) supabase.removeChannel(ch);
      idleDemandSubRef.current = null;
    };
  }, [mode, applyPassengerLocations]);

  const stopTripSubscription = useCallback(() => {
    if (tripSubRef.current) {
      supabase.removeChannel(tripSubRef.current);
      tripSubRef.current = null;
    }
  }, []);

  const refreshActiveTripData = useCallback(async (tripId) => {
    if (!tripId) return;
    const [{ data: row }, { data: reservations, error: resErr }] = await Promise.all([
      fetchTripById(tripId),
      fetchMateTripReservations(tripId),
    ]);
    if (row) {
      setTrip((current) => applyTripRowFromDb(current, row));
      if (row.status === 'completed') {
        setMode('idle');
        setTrip(null);
        return;
      }
    }
    if (resErr) {
      console.warn('[Mate] load reservations:', resErr.message ?? resErr);
    }
    const list = reservations ?? [];
    setReservationCount(list.length);
    setTripReservations(list);
    setLastSyncAt(Date.now());
  }, []);

  const startTripSubscription = useCallback((tripId) => {
    stopTripSubscription();
    const ch = subscribeToTripById(tripId, (row) => {
      setTrip((current) => applyTripRowFromDb(current, row));
      setLastSyncAt(Date.now());
    });
    tripSubRef.current = ch;
    refreshActiveTripData(tripId);
  }, [stopTripSubscription, refreshActiveTripData]);

  // ─── Reservation subscription ──────────────────────────────────────────────
  const startReservationSubscription = useCallback((tripId) => {
    if (reservationSubRef.current) {
      supabase.removeChannel(reservationSubRef.current);
    }
    const ch = subscribeToReservations(tripId, (event) => {
      if (event.type === 'INSERT') {
        setReservationBannerKey((k) => k + 1);
      }
      if (event.reservations) {
        setReservationCount(event.reservations.length);
        setTripReservations(event.reservations);
        setLastSyncAt(Date.now());
      }
      refreshActiveTripData(tripId);
    });
    reservationSubRef.current = ch;
  }, [refreshActiveTripData]);

  const stopReservationSubscription = useCallback(() => {
    if (reservationSubRef.current) {
      supabase.removeChannel(reservationSubRef.current);
      reservationSubRef.current = null;
    }
  }, []);

  // Backup poll — realtime can miss events on flaky networks.
  useEffect(() => {
    if (mode !== 'active' || !trip?.tripId) return undefined;

    const poll = () => {
      fetchMateTripReservations(trip.tripId)
        .then(({ data, error }) => {
          if (error) return;
          const rows = data ?? [];
          setTripReservations(rows);
          setReservationCount(rows.length);
        })
        .catch(() => {});
    };

    poll();
    const id = setInterval(poll, 12_000);
    return () => clearInterval(id);
  }, [mode, trip?.tripId]);

  // ─── Location helpers ──────────────────────────────────────────────────────
  const stopLocationTracking = useCallback(async (skipDelete = false) => {
    if (locationSubRef.current) {
      locationSubRef.current.__appStateSub?.remove?.();
      locationSubRef.current.remove();
      locationSubRef.current = null;
    }
    if (!skipDelete && mateId) {
      await deleteDriverLocation(mateId).catch((e) =>
        console.warn('[Mate] deleteDriverLocation failed:', e.message),
      );
    }
  }, [mateId]);

  const startLocationTracking = useCallback(async (route) => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Location required',
        'Passengers use your location to find you on the map. Please grant location permission in Settings.',
      );
      return;
    }

    try {
      const initial = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const { latitude, longitude } = initial.coords;
      setMateCoords({ latitude, longitude });
      setLastSyncAt(Date.now());
      const currentTrip = tripRef.current;
      if (mateId && currentTrip) {
        await upsertDriverLocation(
          mateId,
          formatRoute(currentTrip.route),
          latitude,
          longitude,
          currentTrip.seatsLeft,
          initial.coords.heading ?? null,
          routeFareGhs(currentTrip.route),
        );
        setLastSyncAt(Date.now());
        setTrip((t) => t && t.locationStatus !== 'active' ? { ...t, locationStatus: 'active' } : t);
      }
    } catch {
      // watch will retry
    }

    // Adaptive upload throttling: 5s foreground, 30s background, paused after
    // 5 minutes idle in background. UI still updates on every fix.
    let appState = AppState.currentState;
    let lastUploadAt = 0;
    let lastBackgroundedAt = appState === 'background' ? Date.now() : null;
    const appSub = AppState.addEventListener('change', (next) => {
      const prev = appState;
      appState = next;
      if (prev !== 'background' && next === 'background') {
        lastBackgroundedAt = Date.now();
      } else if (prev === 'background' && next !== 'background') {
        lastBackgroundedAt = null;
        lastUploadAt = 0; // force an immediate upload on the next fix
      }
    });

    const sub = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.High, timeInterval: 2000, distanceInterval: 8 },
      async (loc) => {
        const currentTrip = tripRef.current;
        if (!mateId || !currentTrip) return;
        const { latitude, longitude } = loc.coords;
        const heading = loc.coords.heading ?? null;
        setMateCoords({ latitude, longitude });

        const now = Date.now();
        const fgInterval = 5_000;
        const bgInterval = 30_000;
        const interval = appState === 'background' ? bgInterval : fgInterval;
        if (
          appState === 'background' &&
          lastBackgroundedAt != null &&
          now - lastBackgroundedAt > 5 * 60_000
        ) {
          return; // paused — backgrounded too long
        }
        if (now - lastUploadAt < interval) return;
        lastUploadAt = now;

        const { error } = await upsertDriverLocation(
          mateId,
          formatRoute(currentTrip.route),
          latitude,
          longitude,
          currentTrip.seatsLeft,
          heading,
          routeFareGhs(currentTrip.route),
        );
        if (error) {
          console.warn('[Mate] upsertDriverLocation failed:', error.message);
        } else {
          setLastSyncAt(Date.now());
          setTrip((t) => t && t.locationStatus !== 'active' ? { ...t, locationStatus: 'active' } : t);
        }
      },
    );
    sub.__appStateSub = appSub;
    locationSubRef.current = sub;
  }, [mateId]);

  // Poll while active trip runs (fallback if Realtime is off or delayed).
  useEffect(() => {
    if (mode !== 'active' || !trip?.tripId) return;
    const id = setInterval(() => {
      refreshActiveTripData(trip.tripId);
    }, LIVE_POLL_MS);
    return () => clearInterval(id);
  }, [mode, trip?.tripId, refreshActiveTripData]);

  // Refresh nearby passenger pins as the mate moves.
  useEffect(() => {
    if (mode !== 'active' || !mateCoords) return;
    fetchPassengerLocations({ center: mateCoords, radiusKm: 8 })
      .then(({ data, error }) => {
        if (!error) {
          setPassengerLocations(data ?? []);
          setLastSyncAt(Date.now());
        }
      })
      .catch(() => {});
  }, [mode, mateCoords]);

  // ─── Trip actions ──────────────────────────────────────────────────────────
  const [setupOpenCustom, setSetupOpenCustom] = useState(false);
  const startSetup  = useCallback(() => { setSetupOpenCustom(false); setMode('setup'); }, []);
  const startSetupWithCustom = useCallback(() => { setSetupOpenCustom(true); setMode('setup'); }, []);
  const cancelSetup = useCallback(() => { setSetupOpenCustom(false); setMode('idle'); }, []);

  const updateActiveTripDestination = useCallback(async ({ origin, destination }) => {
    if (!trip?.tripId) return;
    const newRouteLabel = `${origin} - ${destination}`;
    const { data, error } = await updateTripDestination(trip.tripId, {
      route: newRouteLabel,
      origin,
      destination,
    });
    if (error) {
      Alert.alert('Could not update destination', formatSupabaseError(error.message));
      return;
    }
    setTrip((current) => {
      if (!current) return current;
      return {
        ...current,
        route: {
          ...(current.route ?? {}),
          origin,
          destination,
        },
      };
    });
    if (mateId && data) {
      const nextRoute = { ...(trip.route ?? {}), origin, destination };
      upsertDriverLocation(
        mateId,
        formatRoute(nextRoute),
        mateCoords?.latitude ?? null,
        mateCoords?.longitude ?? null,
        trip.seatsLeft,
        null,
        routeFareGhs(nextRoute),
      ).catch(() => {});
    }
  }, [trip, mateId, mateCoords]);

  const departTrip = useCallback(async ({ route, totalSeats }) => {
    setDepartLoading(true);
    try {
      const { data: activeTrip } = await getActiveMateTrip(mateId);
      if (activeTrip) {
        Alert.alert(
          'Trip already active',
          'You already have a trip running. End it on the dashboard before starting a new one.',
        );
        return;
      }

      const fare = routeFareGhs(route);

      const { data, error } = await createTrip(
        mateId,
        formatRoute(route),
        route.origin,
        route.destination,
        totalSeats,
        fare,
      );
      if (error) {
        Alert.alert('Could not start trip', formatSupabaseError(error.message));
        return;
      }

      let tripRow = data;
      if (fare != null && (tripRow.fare_ghs == null || Number(tripRow.fare_ghs) <= 0)) {
        const { data: patched } = await updateTripFare(tripRow.id, fare);
        if (patched) tripRow = patched;
      }

      const routeWithFare = {
        ...route,
        fareGhs: tripRow.fare_ghs ?? fare,
      };
      const newTrip = {
        tripId: tripRow.id,
        route: routeWithFare,
        totalSeats,
        seatsLeft: tripRow.available_seats ?? totalSeats,
        passengersOnboarded: 0,
        locationStatus: 'pending',
        startedAt: tripRow.created_at ?? new Date().toISOString(),
      };
      console.log('[Mate] Trip started in Supabase →', {
        id: tripRow.id,
        route: formatRoute(routeWithFare),
        totalSeats,
        fareGhs: routeWithFare.fareGhs,
      });
      setTrip(newTrip);
      setMode('active');
      setReservationCount(0);
      startReservationSubscription(tripRow.id);
      startTripSubscription(tripRow.id);
      startPassengerSubscription();
      await startLocationTracking(routeWithFare);
    } finally {
      setDepartLoading(false);
    }
  }, [mateId, startLocationTracking, startReservationSubscription, startTripSubscription, startPassengerSubscription]);

  const onboard = useCallback(() => {
    setTrip((current) => {
      if (!current || current.seatsLeft <= 0) return current;
      const seatsLeft = current.seatsLeft - 1;
      const status    = seatsLeft === 0 ? 'full' : 'active';
      const next = { ...current, seatsLeft, passengersOnboarded: current.passengersOnboarded + 1 };

      console.log('[Mate] Passenger onboarded →', { passengersOnboarded: next.passengersOnboarded, seatsLeft });
      updateTripSeats(current.tripId, seatsLeft, status)
        .catch((e) => console.warn('[Mate] updateTripSeats failed:', e.message));
      upsertDriverLocation(
        mateId,
        formatRoute(next.route),
        mateCoordsRef.current?.latitude ?? null,
        mateCoordsRef.current?.longitude ?? null,
        seatsLeft,
        null,
        routeFareGhs(next.route),
      )
        .catch((e) => console.warn('[Mate] location seats sync failed:', e.message));

      if (seatsLeft === 0) console.log('[Mate] Trip auto-marked full');
      return next;
    });
  }, [mateId]);

  const boardReservedPassenger = useCallback(async (reservationId) => {
    if (!mateId || !reservationId) return;
    const { data, error } = await boardReservation(reservationId, mateId);
    if (error || data?.ok === false) {
      Alert.alert('Could not board', error?.message ?? data?.error ?? 'Try again');
      return;
    }
    setTrip((current) => {
      if (!current) return current;
      const seatsLeft = data.available_seats ?? current.seatsLeft;
      return {
        ...current,
        seatsLeft,
        passengersOnboarded: current.passengersOnboarded + 1,
      };
    });
    const tripId = tripRef.current?.tripId;
    if (tripId) {
      const { data: list } = await fetchMateTripReservations(tripId);
      const rows = list ?? [];
      setTripReservations(rows);
      setReservationCount(rows.length);
    }
  }, [mateId]);

  const markTripFull = useCallback(() => {
    setTrip((current) => {
      if (!current || current.seatsLeft === 0) return current;
      const filled = { ...current, passengersOnboarded: current.passengersOnboarded + current.seatsLeft, seatsLeft: 0 };

      console.log('[Mate] Trip manually marked full →', filled);
      updateTripSeats(current.tripId, 0, 'full')
        .catch((e) => console.warn('[Mate] updateTripSeats failed:', e.message));
      upsertDriverLocation(
        mateId,
        formatRoute(filled.route),
        mateCoordsRef.current?.latitude ?? null,
        mateCoordsRef.current?.longitude ?? null,
        0,
        null,
        routeFareGhs(filled.route),
      )
        .catch((e) => console.warn('[Mate] location seats sync failed:', e.message));

      return filled;
    });
  }, [mateId]);

  const handleEndTrip = useCallback(async () => {
    const current = tripRef.current;
    if (current?.tripId) {
      await endTripDb(current.tripId)
        .catch((e) => console.warn('[Mate] endTrip DB failed:', e.message));
    }

    if (current?.passengersOnboarded > 0) {
      const amountGhs = current.passengersOnboarded * getRouteFare(current.route);
      const nextTotal = await recordTripEarnings({
        amountGhs,
        route: formatRoute(current.route),
        passengers: current.passengersOnboarded,
      }).catch(() => earningsTotal);
      setEarningsTotal(nextTotal);
    }

    await stopLocationTracking(false);
    stopReservationSubscription();
    stopTripSubscription();
    stopPassengerSubscription();
    setMateCoords(null);
    setReservationCount(0);
    if (current) {
      console.log('[Mate] Trip ended →', {
        id: current.tripId,
        route: formatRoute(current.route),
        passengersOnboarded: current.passengersOnboarded,
        durationMs: Date.now() - new Date(current.startedAt).getTime(),
      });
    }
    setTrip(null);
    setMode('idle');
  }, [stopLocationTracking, stopReservationSubscription, stopTripSubscription, stopPassengerSubscription, earningsTotal]);

  useEffect(() => {
    if (!mateId || restoredTripRef.current) return;
    restoredTripRef.current = true;

    (async () => {
      const { data: activeTrip } = await getActiveMateTrip(mateId);
      if (!activeTrip) return;

      const routeId = findRouteIdByLabel(activeTrip.route);
      let route = findRouteById(routeId);
      if (!route) {
        const customs = await getCustomRoutes().catch(() => []);
        const customMatch = customs.find(
          (r) =>
            r.origin === activeTrip.origin &&
            r.destination === activeTrip.destination,
        );
        route = customMatch ?? {
          id: routeId ?? `custom_restored_${activeTrip.id}`,
          origin: activeTrip.origin,
          destination: activeTrip.destination,
          fareGhs: activeTrip.fare_ghs ?? getRouteFare(null),
          mapCenter:
            getPlaceCoords(activeTrip.origin) ??
            getPlaceCoords(activeTrip.destination) ??
            DEFAULT_MAP_REGION,
          isCustom: !customMatch,
        };
      }
      if (route && activeTrip.fare_ghs != null && Number(activeTrip.fare_ghs) > 0) {
        route = { ...route, fareGhs: Number(activeTrip.fare_ghs) };
      }

      const restored = {
        tripId: activeTrip.id,
        route,
        totalSeats: activeTrip.total_seats,
        seatsLeft: activeTrip.available_seats,
        passengersOnboarded: Math.max(0, activeTrip.total_seats - activeTrip.available_seats),
        locationStatus: 'pending',
        startedAt: activeTrip.created_at,
      };

      setTrip(restored);
      setMode('active');
      setReservationCount(0);
      startReservationSubscription(activeTrip.id);
      startTripSubscription(activeTrip.id);
      startPassengerSubscription();
      await startLocationTracking(route);
    })();
  }, [
    mateId,
    startLocationTracking,
    startPassengerSubscription,
    startReservationSubscription,
    startTripSubscription,
  ]);

  // Cleanup on unmount.
  useEffect(() => {
    return () => {
      stopLocationTracking(false);
      stopReservationSubscription();
      stopTripSubscription();
      stopPassengerSubscription();
    };
  }, [stopLocationTracking, stopReservationSubscription, stopTripSubscription, stopPassengerSubscription]);

  const defaultRouteId = findRouteIdByLabel(profile?.default_route);

  if (!mateId) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <Text style={{ color: C.TEXT, fontSize: 16, fontWeight: '700', textAlign: 'center' }}>
            Session error — please sign out and log in again on the Mate tab.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.dashboardHeader}>
        <View style={styles.dashboardLogoRow}>
          <View style={styles.dashboardLogoIcon}>
            <Ionicons name="bus" size={16} color={C.ACCENT} />
          </View>
          <View>
            <Text style={styles.dashboardName} numberOfLines={1}>{profile?.full_name ?? 'Mate Dashboard'}</Text>
            <Text style={styles.dashboardSub} numberOfLines={1}>
              {[profile?.vehicle_type, profile?.vehicle_registration].filter(Boolean).join(' · ') || 'No vehicle on file'}
            </Text>
          </View>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Edit profile"
          onPress={onOpenProfile}
          hitSlop={12}
          style={({ pressed }) => [styles.profileButton, pressed && { opacity: 0.8 }]}>
          <View style={styles.profileButtonInner}>
            <Ionicons name="person-outline" size={17} color={C.TEXT_SUB} />
          </View>
        </Pressable>
      </View>

      {!profile ? (
        <View style={styles.profileWarning}>
          <Ionicons name="warning-outline" size={18} color="#FCD34D" />
          <Text style={styles.profileWarningText}>
            Profile incomplete — open Account to add your name and vehicle plate before passengers see your trip.
          </Text>
        </View>
      ) : null}

      <View style={styles.dashboardBody}>
        {mode === 'idle' ? (
          <IdleView
            onStart={startSetup}
            onStartWithDestination={startSetupWithCustom}
            onOpenEarn={onOpenEarn}
            demand={idleDemand}
            earningsTotal={earningsTotal}
            lastSyncAt={lastSyncAt}
            defaultRouteLabel={profile?.default_route ?? null}
          />
        ) : null}
        {mode === 'setup' ? (
          <SetupView
            onDepart={departTrip}
            onCancel={cancelSetup}
            defaultRouteId={defaultRouteId}
            loading={departLoading}
            demand={idleDemand}
            lastSyncAt={lastSyncAt}
            startWithCustomEditor={setupOpenCustom}
            mateCoords={mateCoords}
            vehicleType={profile?.vehicle_type ?? DEFAULT_VEHICLE_TYPE}
          />
        ) : null}
        {mode === 'active' && trip ? (
          <ActiveView
            trip={trip}
            onOnboard={onboard}
            onBoardReservation={boardReservedPassenger}
            onTripFull={markTripFull}
            onEndTrip={handleEndTrip}
            onOpenEarn={onOpenEarn}
            onUpdateDestination={updateActiveTripDestination}
            reservationBannerKey={reservationBannerKey}
            reservationCount={reservationCount}
            tripReservations={tripReservations}
            mateCoords={mateCoords}
            passengerLocations={passengerLocations}
            lastSyncAt={lastSyncAt}
          />
        ) : null}
      </View>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: C.BG },
  flex1:    { flex: 1 },

  // Banner
  banner:     { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 99, backgroundColor: C.SUCCESS, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, gap: 8 },
  bannerText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },

  // Dashboard header
  dashboardHeader:    { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: C.BORDER },
  profileWarning:     { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginHorizontal: 20, marginTop: 12, padding: 12, borderRadius: 12, backgroundColor: 'rgba(234,179,8,0.1)', borderWidth: 1, borderColor: 'rgba(234,179,8,0.3)' },
  profileWarningText: { flex: 1, color: '#FCD34D', fontSize: 12, lineHeight: 18 },
  dashboardLogoRow:   { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 12 },
  dashboardLogoIcon:  { width: 36, height: 36, borderRadius: 10, backgroundColor: C.ACCENT_SOFT, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.ACCENT + '40' },
  dashboardName:      { color: C.TEXT, fontSize: 16, fontWeight: '700' },
  dashboardSub:       { color: C.TEXT_MUTED, fontSize: 12, marginTop: 1 },
  profileButton:      {},
  profileButtonInner: { width: 38, height: 38, borderRadius: 10, backgroundColor: C.SURFACE_UP, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.BORDER },

  dashboardBody: { flex: 1 },
  // Idle
  idleWrap:      { flex: 1 },
  idleScroll:    { flexGrow: 1, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 16 },
  idleFooter:    { paddingHorizontal: 20, paddingTop: 16, paddingBottom: TAB_FOOTER_CLEARANCE, backgroundColor: C.BG, borderTopWidth: 1, borderTopColor: C.BORDER },
  idleCard:      { backgroundColor: C.SURFACE, borderRadius: 20, alignItems: 'center', justifyContent: 'center', paddingVertical: 28, paddingHorizontal: 24, borderWidth: 1, borderColor: C.BORDER, gap: 12, marginBottom: 12 },
  idleIconRing:  { width: 80, height: 80, borderRadius: 24, backgroundColor: C.SURFACE_UP, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.BORDER, marginBottom: 4 },
  idleTitle:     { color: C.TEXT, fontSize: 20, fontWeight: '700' },
  idleSub:       { color: C.TEXT_MUTED, fontSize: 14, textAlign: 'center', maxWidth: 260, lineHeight: 20 },
  demandPanel:         { backgroundColor: C.SURFACE, borderRadius: 16, padding: 16, marginVertical: 16, borderWidth: 1, borderColor: 'rgba(251,191,36,0.25)' },
  demandHeader:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  demandHeaderLeft:    { flexDirection: 'row', alignItems: 'center', gap: 7 },
  demandHeaderText:    { color: '#FBBF24', fontSize: 13, fontWeight: '700', letterSpacing: 0.3 },
  demandHeaderBadge:   { backgroundColor: 'rgba(251,191,36,0.15)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  demandHeaderBadgeText:{ color: '#FBBF24', fontSize: 11, fontWeight: '700' },
  demandList:          { gap: 8 },
  demandRow:           { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10 },
  demandRoute:         { color: C.TEXT, fontSize: 13, fontWeight: '600', flex: 1, paddingRight: 8 },
  demandCount:         { flexDirection: 'row', alignItems: 'center', gap: 4 },
  demandCountText:     { color: '#FBBF24', fontSize: 13, fontWeight: '800' },

  idleStatsRow:  { flexDirection: 'row', gap: 10, marginVertical: 16 },
  statCard:      { flex: 1, backgroundColor: C.SURFACE, borderRadius: 14, padding: 12, alignItems: 'center', gap: 4, borderWidth: 1, borderColor: C.BORDER },
  statCardTop:   { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 22 },
  statLabelLive: { color: C.ACCENT },
  routeDemandRow: {
    flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8,
    marginTop: 12, padding: 12, borderRadius: 12,
    backgroundColor: 'rgba(251,191,36,0.08)', borderWidth: 1, borderColor: 'rgba(251,191,36,0.2)',
  },
  routeDemandText: { color: C.TEXT_SUB, fontSize: 13, fontWeight: '600', flex: 1 },
  routeDemandSync: { color: C.TEXT_MUTED, fontSize: 11, fontWeight: '600' },
  statLabel:     { color: C.TEXT, fontSize: 12, fontWeight: '700' },
  statSub:       { color: C.TEXT_MUTED, fontSize: 10, textAlign: 'center' },
  earnCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: C.SURFACE,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: C.ACCENT + '40',
  },
  earnCardLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  earnIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: C.ACCENT_SOFT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  earnText: { flex: 1 },
  earnTitle: { color: C.TEXT, fontSize: 15, fontWeight: '800' },
  earnSub: { color: C.TEXT_MUTED, fontSize: 12, marginTop: 2 },
  startButton:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: C.ACCENT, borderRadius: 14, minHeight: 58, gap: 10, shadowColor: C.ACCENT, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 12 },
  startButtonText: { color: '#FFFFFF', fontSize: 18, fontWeight: '800' },

  // Setup
  setupWrap:           { flex: 1 },
  setupScroll:         { flexGrow: 1, paddingHorizontal: 20, paddingTop: 8, paddingBottom: 16 },
  setupFooter:         { paddingHorizontal: 20, paddingTop: 12, paddingBottom: TAB_FOOTER_CLEARANCE, backgroundColor: C.BG, borderTopWidth: 1, borderTopColor: C.BORDER },
  setupHeader:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 },
  setupHeading:        { color: C.TEXT, fontSize: 20, fontWeight: '800' },
  iconButton:          { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  backButton:          { width: 36, height: 36, borderRadius: 10, backgroundColor: C.SURFACE, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.BORDER },
  sectionLabel:        { color: C.TEXT_MUTED, fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 12, marginTop: 8 },
  routeList:           { gap: 8, marginBottom: 24 },
  routeRow:            { flexDirection: 'row', alignItems: 'center', backgroundColor: C.SURFACE, borderRadius: 14, paddingHorizontal: 16, minHeight: 58, borderWidth: 1, borderColor: C.BORDER, gap: 14 },
  routeRowSelected:    { borderColor: C.ACCENT + '80', backgroundColor: 'rgba(243,111,33,0.08)' },
  routeRadio:          { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: C.TEXT_MUTED, alignItems: 'center', justifyContent: 'center' },
  routeRadioSelected:  { borderColor: C.ACCENT },
  routeRadioDot:       { width: 10, height: 10, borderRadius: 5, backgroundColor: C.ACCENT },
  routeRowText:        { color: C.TEXT_SUB, fontSize: 15, fontWeight: '600' },
  routeRowTextWrap:    { flex: 1 },
  routeRowTextSelected:{ color: C.TEXT },
  routeRowLabelRow:    { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  routeFareTag:        { color: C.SUCCESS, fontSize: 11, fontWeight: '700', marginTop: 2 },
  customBadge: {
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6,
    backgroundColor: C.ACCENT_SOFT,
    borderWidth: 1, borderColor: C.ACCENT + '55',
  },
  customBadgeText: { color: C.ACCENT, fontSize: 9, fontWeight: '800', letterSpacing: 0.6 },
  routeRemoveBtn: {
    width: 28, height: 28, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: C.SURFACE_UP,
    borderWidth: 1, borderColor: C.BORDER,
  },
  addCustomBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    minHeight: 52, borderRadius: 14,
    borderWidth: 1, borderStyle: 'dashed', borderColor: C.ACCENT + '66',
    backgroundColor: 'rgba(243,111,33,0.05)',
    marginBottom: 24,
  },
  addCustomText: { color: C.ACCENT, fontSize: 14, fontWeight: '700' },
  addCustomBtnPrimary: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: C.ACCENT,
    borderRadius: 16,
    paddingHorizontal: 14, paddingVertical: 14,
    marginBottom: 18,
    shadowColor: C.ACCENT, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.35, shadowRadius: 12,
  },
  addCustomIcon: {
    width: 36, height: 36, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  addCustomTitle: { color: '#FFFFFF', fontSize: 15, fontWeight: '800', letterSpacing: -0.2 },
  addCustomSub: { color: 'rgba(255,255,255,0.85)', fontSize: 12, fontWeight: '600', marginTop: 2 },
  destinationCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: C.SURFACE,
    borderRadius: 16,
    borderWidth: 1, borderColor: C.ACCENT + '55',
    paddingHorizontal: 14, paddingVertical: 14,
    marginBottom: 14,
  },
  destinationIcon: {
    width: 40, height: 40, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: C.ACCENT_SOFT ?? 'rgba(243,111,33,0.12)',
    borderWidth: 1, borderColor: C.ACCENT + '40',
  },
  destinationText: { flex: 1 },
  destinationLabel: { color: C.TEXT, fontSize: 15, fontWeight: '800', letterSpacing: -0.2 },
  destinationSub: { color: C.TEXT_SUB, fontSize: 12, fontWeight: '500', marginTop: 2 },
  customForm: {
    backgroundColor: C.SURFACE,
    borderRadius: 16, padding: 16, marginBottom: 24,
    borderWidth: 1, borderColor: C.ACCENT + '55',
  },
  customFormTitle: { color: C.TEXT, fontSize: 15, fontWeight: '800', marginBottom: 10 },
  customLabel: { color: C.TEXT_MUTED, fontSize: 10, fontWeight: '700', letterSpacing: 1, marginTop: 10, marginBottom: 6 },
  customLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
    marginBottom: 6,
  },
  myLocChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: C.ACCENT_SOFT ?? 'rgba(243,111,33,0.12)',
    borderWidth: 1, borderColor: C.ACCENT + '40',
  },
  myLocChipText: { color: C.ACCENT, fontSize: 10, fontWeight: '800', letterSpacing: 0.4 },
  customInput: {
    backgroundColor: C.SURFACE_UP,
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10,
    color: C.TEXT, fontSize: 14,
    borderWidth: 1, borderColor: C.BORDER,
  },
  suggestionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  suggestionChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: C.SURFACE_UP,
    borderWidth: 1, borderColor: C.BORDER,
  },
  suggestionChipText: { color: C.TEXT_SUB, fontSize: 12, fontWeight: '600' },
  customActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 14 },
  customGhostBtn: { paddingHorizontal: 14, paddingVertical: 10 },
  customGhostText: { color: C.TEXT_SUB, fontSize: 14, fontWeight: '700' },
  customPrimaryBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: C.ACCENT,
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10,
  },
  customPrimaryText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  estEarningsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(34,197,94,0.08)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.2)',
  },
  estEarningsText: { color: C.SUCCESS, fontSize: 13, fontWeight: '700' },
  stepperCard:         { flexDirection: 'row', alignItems: 'center', backgroundColor: C.SURFACE, borderRadius: 16, borderWidth: 1, borderColor: C.BORDER, marginBottom: 24, overflow: 'hidden' },
  stepperBtn:          { width: 68, height: 72, alignItems: 'center', justifyContent: 'center', backgroundColor: C.SURFACE_UP },
  stepperBtnDisabled:  { opacity: 0.3 },
  stepperCenter:       { flex: 1, alignItems: 'center' },
  stepperValue:        { color: C.TEXT, fontSize: 38, fontWeight: '800', lineHeight: 42 },
  stepperHint:         { color: C.TEXT_MUTED, fontSize: 12, fontWeight: '600' },
  stepperSubLabel:     { color: C.TEXT_SUB, fontSize: 12, fontWeight: '600', marginBottom: 8 },
  departButton:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: C.ACCENT, borderRadius: 14, minHeight: 58, gap: 10, marginTop: 8, shadowColor: C.ACCENT, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 12 },
  departButtonDisabled:{ backgroundColor: C.SURFACE_UP, shadowOpacity: 0 },
  departButtonText:    { color: '#FFFFFF', fontSize: 18, fontWeight: '800' },

  // Active
  activeContainer: { flex: 1, paddingHorizontal: 20, paddingTop: 16, minHeight: 0 },

  activeTripCard:    { flexShrink: 0, backgroundColor: C.SURFACE, borderRadius: 18, padding: 18, borderWidth: 1, borderColor: C.BORDER, marginBottom: 14 },
  activeTripTop:     { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 },
  activeTripInfo:    { flex: 1, paddingRight: 12 },
  activeRouteHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  activeRouteLabel:  { color: C.TEXT_MUTED, fontSize: 10, fontWeight: '700', letterSpacing: 1 },
  editDestBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: C.ACCENT_SOFT ?? 'rgba(243,111,33,0.12)',
    borderWidth: 1, borderColor: C.ACCENT + '40',
  },
  editDestBtnText: { color: C.ACCENT, fontSize: 10, fontWeight: '800', letterSpacing: 0.4 },
  destEditBox: {
    backgroundColor: C.SURFACE_UP,
    borderRadius: 14, padding: 14, marginBottom: 14,
    borderWidth: 1, borderColor: C.ACCENT + '55',
  },
  destEditTitle: { color: C.TEXT, fontSize: 14, fontWeight: '800', marginBottom: 4 },
  destEditActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 12 },
  activeRoute:       { color: C.TEXT, fontSize: 22, fontWeight: '800', letterSpacing: -0.3, lineHeight: 28 },
  seatCircle:        { width: 60, height: 60, borderRadius: 30, borderWidth: 3, alignItems: 'center', justifyContent: 'center' },
  seatCircleNum:     { fontSize: 22, fontWeight: '900', lineHeight: 24 },
  seatCircleLabel:   { color: C.TEXT_MUTED, fontSize: 10, fontWeight: '700' },
  liveStatsRow:      { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  liveStatPill:        { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: C.SURFACE_UP, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: C.BORDER },
  liveStatText:        { color: C.TEXT_SUB, fontSize: 11, fontWeight: '700' },
  activeTripMeta:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  metaLeft:          { flex: 1, minWidth: 0 },
  locationBadge:     { flexDirection: 'row', alignItems: 'center', gap: 7 },
  locationDot:       { width: 7, height: 7, borderRadius: 4, backgroundColor: C.TEXT_MUTED },
  locationDotActive: { backgroundColor: C.SUCCESS },
  locationBadgeText: { color: C.TEXT_MUTED, fontSize: 12, fontWeight: '600' },
  syncHint: { color: C.TEXT_MUTED, fontSize: 10, fontWeight: '600' },
  mapToggle:         { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, borderWidth: 1, borderColor: C.BORDER, backgroundColor: C.SURFACE_UP },
  mapToggleOn:       { borderColor: C.ACCENT + '60', backgroundColor: C.ACCENT_SOFT },
  mapToggleText:     { color: C.TEXT_SUB, fontSize: 13, fontWeight: '700' },

  activeBody:      { flex: 1, minHeight: 120 },
  activeFooter:    { paddingTop: 12, paddingBottom: TAB_FOOTER_CLEARANCE, borderTopWidth: 1, borderTopColor: C.BORDER },
  onboardButton:   { flex: 1, minHeight: 140, borderRadius: 20, backgroundColor: C.ACCENT, alignItems: 'center', justifyContent: 'center', shadowColor: C.ACCENT, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.45, shadowRadius: 16, elevation: 8 },
  onboardButtonFull: { backgroundColor: Theme.colors.seatFull, shadowOpacity: 0 },
  onboardButtonInner: { alignItems: 'center', gap: 8 },
  onboardButtonText:  { color: '#FFFFFF', fontSize: 28, fontWeight: '900', letterSpacing: 0.5 },
  onboardButtonSub:   { color: 'rgba(255,255,255,0.6)', fontSize: 13, fontWeight: '500' },
  reservationList: { paddingHorizontal: 20, paddingBottom: 12, gap: 8 },
  reservationListTitle: { color: C.TEXT_SUB, fontSize: 12, fontWeight: '700', marginBottom: 4 },
  reservationPanel: {
    flexShrink: 0,
    backgroundColor: 'rgba(243,111,33,0.1)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 6,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: C.ACCENT + '55',
  },
  reservationPanelHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  reservationPanelTitle: { color: C.ACCENT, fontSize: 12, fontWeight: '800', flex: 1 },
  reservationPanelScroll: { maxHeight: 88 },
  reservationPanelScrollContent: { gap: 6, paddingBottom: 2 },
  reservationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: C.SURFACE,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: C.BORDER,
  },
  reservationRowBody: { flex: 1, minWidth: 0 },
  reservationRowText: { color: C.TEXT, fontSize: 13, fontWeight: '600' },
  reservationRowSub: { color: C.TEXT_MUTED, fontSize: 11, fontWeight: '500', marginTop: 2 },
  reservationBoardBtn: { color: C.ACCENT, fontWeight: '800', fontSize: 13 },
  liveStatPillReserved: {
    backgroundColor: 'rgba(243,111,33,0.15)',
    borderColor: C.ACCENT + '66',
    borderWidth: 1,
  },
  liveStatTextReserved: { color: C.ACCENT, fontWeight: '800' },
  activeSecondaryRow: { flexDirection: 'row', gap: 12 },
  fullButton:    { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: C.SURFACE, borderRadius: 14, minHeight: 52, borderWidth: 1, borderColor: C.ACCENT + '50' },
  fullButtonText:{ color: C.ACCENT, fontSize: 15, fontWeight: '700' },
  endButton:     { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: C.SURFACE, borderRadius: 14, minHeight: 52, borderWidth: 1, borderColor: C.BORDER },
  endButtonText: { color: C.TEXT_MUTED, fontSize: 15, fontWeight: '700' },

  mateMapWrapper: {
    flex: 1,
    minHeight: 300,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#060606',
    borderWidth: 1,
    borderColor: C.BORDER,
  },
  mapEmptyOverlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 14 },
  mapEmptyPill:    { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(0,0,0,0.75)', paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999 },
  mapEmptyText:    { color: C.TEXT_SUB, fontSize: 12 },

  tripPinWrap:         { alignItems: 'center' },
  tripPin:             {
    width: 34, height: 34, borderRadius: 17,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2.5, borderColor: '#FFFFFF',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.35, shadowRadius: 4,
  },
  tripPinOrigin:       { backgroundColor: Theme.colors.success },
  tripPinDest:         { backgroundColor: C.ACCENT },
  tripPinLabel:        {
    marginTop: 4,
    backgroundColor: 'rgba(15,23,42,0.92)',
    borderRadius: 8,
    paddingHorizontal: 8, paddingVertical: 3,
    maxWidth: 140,
  },
  tripPinLabelText:    { color: '#FFFFFF', fontSize: 10, fontWeight: '800', letterSpacing: 0.2 },
  tripPinTail:         {
    width: 0, height: 0,
    borderLeftWidth: 5, borderRightWidth: 5, borderTopWidth: 6,
    borderLeftColor: 'transparent', borderRightColor: 'transparent',
    marginTop: -1,
  },
  tripPinTailOrigin:   { borderTopColor: 'rgba(15,23,42,0.92)' },
  tripPinTailDest:     { borderTopColor: 'rgba(15,23,42,0.92)' },
  mapLegend:           {
    position: 'absolute',
    top: 10, left: 10,
    backgroundColor: 'rgba(15,23,42,0.88)',
    borderRadius: 10,
    paddingHorizontal: 10, paddingVertical: 8,
    gap: 4,
    maxWidth: 200,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  mapLegendRow:        { flexDirection: 'row', alignItems: 'center', gap: 6 },
  mapLegendDot:        { width: 8, height: 8, borderRadius: 4 },
  mapLegendText:       { color: '#FFFFFF', fontSize: 10, fontWeight: '700', maxWidth: 160 },
  calloutCard:         { backgroundColor: '#1E1E1E', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 9, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', minWidth: 150 },
  calloutTitle:        { color: C.TEXT, fontSize: 13, fontWeight: '700' },
  calloutSub:          { color: C.ACCENT, fontSize: 12, fontWeight: '600', marginTop: 2 },
});
