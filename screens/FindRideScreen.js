import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRoute } from '@react-navigation/native';
import {
  Alert,
  FlatList,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import RatingModal from '@/components/RatingModal';
import BrandHeader from '@/components/BrandHeader';
import PremiumBackground from '@/components/PremiumBackground';
import LiveRouteMap from '@/components/passenger/LiveRouteMap';
import RideDetailsSheet from '@/components/passenger/RideDetailsSheet';
import RouteResultsHeader from '@/components/passenger/RouteResultsHeader';
import RouteRideCard from '@/components/passenger/RouteRideCard';
import RoutePlanner from '@/components/RoutePlanner';
import PassengerProblemBanner from '@/components/passenger/PassengerProblemBanner';
import { PASSENGER } from '@/constants/problemSolution';
import { findRouteByPlaces, formatRoute, getPlaceCoords, getRouteFare, routes } from '@/constants/routes';
import { tripMatchesRoute } from '@/utils/routeMatching';
import { TAB_BAR_CLEARANCE, TAB_FOOTER_CLEARANCE, SCREEN_GUTTER } from '@/constants/layout';
import { Theme } from '@/constants/theme';
import { summarizeRoutePickup } from '@/utils/rideEta';
import { getEta } from '@/services/etaService';
import { bboxKey } from '@/utils/geo';
import useSupabaseChannel from '@/hooks/useSupabaseChannel';
import usePassengerLocationSync from '@/hooks/usePassengerLocationSync';
import {
  clearActiveReservationCache,
  getActiveReservationCache,
  getOrCreateDeviceId,
  getPassengerProfile,
  saveActiveReservationCache,
} from '@/services/passengerProfile';
import {
  cancelReservation,
  createReservation,
  ensurePassengerProfileExists,
  expireStaleReservations,
  fetchNearbyDriverLocations,
  fetchNearbyActiveTrips,
  fetchPassengerLocations,
  getActiveReservation,
  getMateRatingAverages,
  submitRating,
  isPassengerLocationsAvailable,
  subscribeToDriverLocations,
  subscribeToPassengerLocations,
  subscribeToTrips,
  upsertPassengerLocation,
} from '@/services/supabase';
import { buildDemandFromLocations } from '@/utils/passengerDemand';

// ─── Design tokens ────────────────────────────────────────────────────────────
const C = {
  BG:           '#0C0C0C',
  SURFACE:      '#161616',
  SURFACE_UP:   '#1E1E1E',
  BORDER:       'rgba(255,255,255,0.07)',
  ACCENT:       '#F97316',
  ACCENT_SOFT:  'rgba(249,115,22,0.14)',
  SUCCESS:      '#22C55E',
  SUCCESS_SOFT: 'rgba(34,197,94,0.12)',
  WARN:         '#EAB308',
  DANGER:       '#EF4444',
  FULL:         '#7F1D1D',
  TEXT:         '#F9FAFB',
  TEXT_SUB:     '#9CA3AF',
  TEXT_MUTED:   '#4B5563',
};

const DEMAND_POLL_MS = 5000;
/** Radius (km) for nearby vehicle / passenger / demand queries. */
const NEARBY_RADIUS_KM = 8;

// ─── Helpers ──────────────────────────────────────────────────────────────────
function tripToCard(t) {
  const mate = t.mate_profiles ?? {};
  const routeLabel = t.route ?? `${t.origin} → ${t.destination}`;
  const routeMatch = routes.find((r) => formatRoute(r) === routeLabel);
  const fare = getRouteFare(routeMatch);
  return {
    id: t.id, tripId: t.id,
    mateId:         t.mate_id,
    destination:    t.destination,
    originStation:  t.origin,
    routeLabel,
    departureTime:  'Live now',
    availableSeats: t.available_seats,
    fare:           `GHS ${fare}`,
    fareGhs:        fare,
    status:         t.status,
    isLive:         true,
    mateName:       mate.full_name ?? null,
    plate:          mate.vehicle_registration ?? null,
    vehicleType:    mate.vehicle_type ?? null,
  };
}

function reservationToTripCard(reservation) {
  const trip = reservation?.trips;
  if (!trip) return null;
  return {
    ...tripToCard(trip),
    reservationId: reservation.id,
    expiresAt: reservation.expires_at,
  };
}

function formatCountdown(expiresAt) {
  if (!expiresAt) return '';
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return 'Expired';
  const mins = Math.floor(ms / 60000);
  const secs = Math.floor((ms % 60000) / 1000);
  return `${mins}:${String(secs).padStart(2, '0')} left`;
}

// ─── Main screen ──────────────────────────────────────────────────────────────
export default function FindRideScreen({ navigation }) {
  const route = useRoute();
  const [fromPlace,             setFromPlace]             = useState(null);
  const [toPlace,               setToPlace]               = useState(null);
  const [rideSheet,           setRideSheet]           = useState(null);
  const [liveDrivers,         setLiveDrivers]         = useState([]);
  const [liveTrips,           setLiveTrips]           = useState([]);
  const [reserving,           setReserving]           = useState(false);
  const [deviceId,            setDeviceId]            = useState(null);
  const [activeReservationId, setActiveReservationId] = useState(null);
  const [reservedTrip,        setReservedTrip]        = useState(null);
  const [isWaiting,           setIsWaiting]           = useState(false);
  const [reservationExpiresAt, setReservationExpiresAt] = useState(null);
  const [countdown,           setCountdown]           = useState('');
  const [queuedRouteLabel,    setQueuedRouteLabel]    = useState(null);
  const [selectedTripId,      setSelectedTripId]      = useState(null);

  const [demandByRoute,  setDemandByRoute] = useState({});
  const [mateAverages,   setMateAverages]  = useState({});

  // Rating flow state
  const [pendingRating,  setPendingRating]  = useState(null); // { trip, mateName, mateId, tripId }
  const reservedTripRef  = useRef(null);
  const mountedRef       = useRef(true);

  const {
    passengerCoords,
    passengerCoordsRef,
    debouncedRouteLabel,
    setShareRouteLabel,
    restartBroadcast,
    stopBroadcast,
  } = usePassengerLocationSync({
    deviceId,
    fromPlace,
    toPlace,
    activeReservationId,
    isWaiting,
    queuedRouteLabel,
  });

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    (async () => {
      const id = await getOrCreateDeviceId();
      if (!mountedRef.current) return;
      setDeviceId(id);
      await ensurePassengerProfileExists(id).catch(() => {});
    })();
  }, []);

  const isTrackingReserved = !!activeReservationId && !!reservedTrip;
  const showRouteResults = Boolean(debouncedRouteLabel) || isTrackingReserved;

  // Coarse bbox key — only changes when passenger moves >~120 m. Resub-friendly.
  const nearbyKey = useMemo(
    () => bboxKey(passengerCoords, NEARBY_RADIUS_KM) ?? 'none',
    [passengerCoords],
  );

  // Stable callback refs so useSupabaseChannel doesn't re-subscribe on every render.
  const onTripsRef = useRef(() => {});
  onTripsRef.current = (trips) => {
    if (!mountedRef.current) return;
    setLiveTrips(trips);

    // Detect trip completion → prompt rating
    const reserved = reservedTripRef.current;
    if (reserved) {
      const stillActive = trips.some((t) => t.id === reserved.tripId);
      if (!stillActive && !pendingRating) {
        setPendingRating({
          tripId:   reserved.tripId,
          mateId:   reserved.mateId,
          mateName: reserved.mateName,
          trip:     reserved,
        });
        reservedTripRef.current = null;
        setReservedTrip(null);
        setActiveReservationId(null);
        setReservationExpiresAt(null);
        clearActiveReservationCache().catch(() => {});
        stopBroadcast({ removeFromDb: true });
      }
    }

    // Refresh mate rating averages
    const mateIds = [...new Set(trips.map((t) => t.mate_id).filter(Boolean))];
    if (mateIds.length) {
      getMateRatingAverages(mateIds).then((avg) => {
        if (mountedRef.current) setMateAverages(avg);
      }).catch(() => {});
    }
  };

  useSupabaseChannel(
    () =>
      subscribeToTrips((trips) => onTripsRef.current(trips), {
        centerRef: passengerCoordsRef,
        radiusKm: NEARBY_RADIUS_KM,
      }),
    [nearbyKey, showRouteResults],
    { enabled: showRouteResults },
  );

  useSupabaseChannel(
    () =>
      subscribeToDriverLocations((drivers) => {
        if (mountedRef.current) setLiveDrivers(drivers);
      }, {
        centerRef: passengerCoordsRef,
        radiusKm: NEARBY_RADIUS_KM,
      }),
    [nearbyKey, showRouteResults],
    { enabled: showRouteResults },
  );

  // Live demand per route (queue) — only when the DB table exists.
  useSupabaseChannel(
    () =>
      subscribeToPassengerLocations(
        (locs) => {
          if (mountedRef.current) {
            setDemandByRoute(buildDemandFromLocations(locs));
          }
        },
        { centerRef: passengerCoordsRef, radiusKm: NEARBY_RADIUS_KM },
      ),
    [nearbyKey, showRouteResults],
    { enabled: showRouteResults && isPassengerLocationsAvailable() },
  );

  // Single poll loop — only after route is fully chosen (debounced).
  useEffect(() => {
    if (!showRouteResults || !passengerCoords) return undefined;
    const poll = () => {
      if (!mountedRef.current) return;
      fetchNearbyDriverLocations(passengerCoords, NEARBY_RADIUS_KM)
        .then(({ data, error }) => {
          if (mountedRef.current && !error) setLiveDrivers(data ?? []);
        })
        .catch(() => {});
      fetchNearbyActiveTrips(passengerCoords, NEARBY_RADIUS_KM)
        .then(({ data, error }) => {
          if (mountedRef.current && !error) onTripsRef.current(data ?? []);
        })
        .catch(() => {});
      if (isPassengerLocationsAvailable()) {
        fetchPassengerLocations({ center: passengerCoords, radiusKm: NEARBY_RADIUS_KM })
          .then(({ data, error }) => {
            if (mountedRef.current && !error) {
              setDemandByRoute(buildDemandFromLocations(data ?? []));
            }
          })
          .catch(() => {});
      }
    };
    poll();
    const id = setInterval(poll, DEMAND_POLL_MS);
    return () => clearInterval(id);
  }, [showRouteResults, passengerCoords?.latitude, passengerCoords?.longitude]);

  useEffect(() => {
    if (!reservationExpiresAt) {
      setCountdown('');
      return undefined;
    }
    const tick = () => setCountdown(formatCountdown(reservationExpiresAt));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [reservationExpiresAt]);

  useEffect(() => {
    if (!deviceId) return;
    (async () => {
      await expireStaleReservations().catch(() => {});
      const { data: active } = await getActiveReservation(deviceId);
      if (!active) {
        await clearActiveReservationCache();
        return;
      }
      const card = reservationToTripCard(active);
      if (!card) return;
      setShareRouteLabel(card.routeLabel);
      setReservedTrip(card);
      reservedTripRef.current = card;
      setReservationExpiresAt(active.expires_at);
      setFromPlace(card.originStation);
      setToPlace(card.destination);
      setActiveReservationId(active.id);
      if (passengerCoords && deviceId) {
        await upsertPassengerLocation(
          deviceId, active.id,
          passengerCoords.latitude, passengerCoords.longitude,
          card.routeLabel,
        ).catch(() => {});
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deviceId]);

  useEffect(() => {
    if (!countdown || countdown !== 'Expired' || !activeReservationId) return;
    clearReservation();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countdown, activeReservationId]);

  const reservedDriver = useMemo(() => {
    if (!reservedTrip?.mateId) return null;
    return liveDrivers.find((d) => d.mate_id === reservedTrip.mateId) ?? null;
  }, [liveDrivers, reservedTrip]);

  const selectedRouteLabel = fromPlace && toPlace ? `${fromPlace} → ${toPlace}` : null;
  const selectedRouteMeta = useMemo(
    () => findRouteByPlaces(fromPlace, toPlace),
    [fromPlace, toPlace],
  );

  const pickupCoords = useMemo(() => {
    return passengerCoords ?? getPlaceCoords(fromPlace) ?? selectedRouteMeta?.mapCenter ?? null;
  }, [passengerCoords, fromPlace, selectedRouteMeta]);

  const displayReservedTrip = useMemo(() => {
    if (!reservedTrip) return null;
    const live = liveTrips.find((t) => t.id === reservedTrip.tripId);
    const base = live ? {
      ...tripToCard(live),
      reservationId: reservedTrip.reservationId,
      expiresAt: reservedTrip.expiresAt,
    } : reservedTrip;

    const driver = liveDrivers.find((d) => d.mate_id === base.mateId);
    const driverCoords = driver
      ? { latitude: driver.latitude, longitude: driver.longitude }
      : null;
    const eta = getEta({
      driverCoords,
      pickupCoords,
      routeMeta: findRouteByPlaces(base.originStation, base.destination),
      availableSeats: base.availableSeats,
    });

    return { ...base, eta, driverCoords };
  }, [reservedTrip, liveTrips, liveDrivers, pickupCoords]);

  useEffect(() => {
    if (!route.params?.openRideDetails || !reservedTrip) return;
    setRideSheet({ mode: 'active', trip: reservedTrip });
    navigation?.setParams?.({ openRideDetails: undefined });
  }, [route.params?.openRideDetails, reservedTrip?.tripId, navigation]);

  const displayTrips = useMemo(() => {
    if (!showRouteResults || !fromPlace || !toPlace) return [];
    const live = liveTrips.map(tripToCard);
    const matched = live.filter((t) => tripMatchesRoute(t, fromPlace, toPlace));

    // Also show nearby mates with live GPS even if route labels differ slightly
    // (common with custom / typed locations).
    const matchedMateIds = new Set(matched.map((t) => t.mateId));
    for (const driver of liveDrivers) {
      if (!driver.latitude || !driver.longitude || matchedMateIds.has(driver.mate_id)) continue;
      const trip = live.find((t) => t.mateId === driver.mate_id);
      if (trip && !matchedMateIds.has(trip.mateId)) {
        matched.push({ ...trip, nearbyOnly: true });
        matchedMateIds.add(trip.mateId);
      }
    }
    return matched;
  }, [showRouteResults, fromPlace, toPlace, liveTrips, liveDrivers]);

  const enrichedTrips = useMemo(() => {
    if (!fromPlace || !toPlace) return [];

    return displayTrips
      .map((trip) => {
        const driver = liveDrivers.find((d) => d.mate_id === trip.mateId);
        const driverCoords = driver
          ? { latitude: driver.latitude, longitude: driver.longitude }
          : null;
        const eta = getEta({
          driverCoords,
          pickupCoords,
          routeMeta: selectedRouteMeta,
          availableSeats: trip.availableSeats,
        });
        return { ...trip, eta, driverCoords };
      })
      .sort((a, b) => {
        const aFull = a.availableSeats === 0 ? 1 : 0;
        const bFull = b.availableSeats === 0 ? 1 : 0;
        if (aFull !== bFull) return aFull - bFull;
        return (a.eta?.minMinutes ?? 99) - (b.eta?.minMinutes ?? 99);
      });
  }, [displayTrips, liveDrivers, pickupCoords, selectedRouteMeta, fromPlace, toPlace]);

  const routeEtaSummary = useMemo(
    () => summarizeRoutePickup(enrichedTrips.filter((t) => t.availableSeats > 0).map((t) => t.eta)),
    [enrichedTrips],
  );

  const selectedTrip = useMemo(
    () => enrichedTrips.find((t) => t.id === selectedTripId) ?? null,
    [enrichedTrips, selectedTripId],
  );

  useEffect(() => {
    setSelectedTripId(null);
  }, [fromPlace, toPlace]);

  useEffect(() => {
    if (activeReservationId || selectedTripId) return;
    const firstAvailable = enrichedTrips.find((t) => t.availableSeats > 0);
    if (firstAvailable) setSelectedTripId(firstAvailable.id);
  }, [enrichedTrips, activeReservationId, selectedTripId]);

  const handleSwapRoute = () => {
    if (!fromPlace || !toPlace) return;
    setFromPlace(toPlace);
    setToPlace(fromPlace);
  };

  const ensureLocationSharing = async () => {
    const profile = await getPassengerProfile();
    if (profile.shareLocation) return true;
    Alert.alert(
      'Location sharing required',
      'Turn on location sharing in Profile → Privacy so mates can find you and you can track your reserved ride.',
    );
    return false;
  };

  const handleViewDetails = (trip) => {
    const enriched = enrichedTrips.find((t) => t.id === trip.id) ?? trip;
    setSelectedTripId(enriched.id);
    setRideSheet({ mode: 'preview', trip: enriched });
  };

  const handleSelectTrip = (trip) => {
    const enriched = enrichedTrips.find((t) => t.id === trip.id) ?? trip;
    if (enriched.availableSeats === 0) return;
    setSelectedTripId(enriched.id);
  };

  const handleReserve = async (trip) => {
    const enriched = enrichedTrips.find((t) => t.id === trip.id) ?? trip;
    setSelectedTripId(enriched.id);
    if (!(await ensureLocationSharing())) return;
    setRideSheet({ mode: 'preview', trip: enriched });
  };

  const closeRideSheet = () => setRideSheet(null);

  const handleConfirm = async () => {
    const trip = rideSheet?.trip;
    if (!trip || reserving || rideSheet?.mode !== 'preview') return;
    if (!(await ensureLocationSharing())) return;

    let passengerId = deviceId;
    if (!passengerId) {
      passengerId = await getOrCreateDeviceId();
      if (mountedRef.current) setDeviceId(passengerId);
    }
    if (!passengerId) {
      Alert.alert(
        'Not ready',
        'Your passenger profile is still loading. Please wait a moment and try again.',
      );
      return;
    }

    setReserving(true);

    try {
      const { data: resData, error: resError } = await createReservation(trip.tripId, passengerId);
      if (resError) {
        Alert.alert('Reservation failed', resError.message);
        return;
      }

      const resId = resData?.id ?? null;
      const snapshot = { ...trip, reservationId: resId, expiresAt: resData?.expires_at };
      setIsWaiting(false);
      reservedTripRef.current = snapshot;
      setReservedTrip(snapshot);
      setReservationExpiresAt(resData?.expires_at ?? null);
      setFromPlace(trip.originStation);
      setToPlace(trip.destination);
      setShareRouteLabel(trip.routeLabel);
      setActiveReservationId(resId);
      setRideSheet({ mode: 'active', trip: snapshot });

      await saveActiveReservationCache({ reservationId: resId, tripId: trip.tripId });

      if (passengerCoords && deviceId) {
        await upsertPassengerLocation(
          deviceId, resId,
          passengerCoords.latitude, passengerCoords.longitude,
          trip.routeLabel,
        ).catch(() => {});
      }
    } finally {
      setReserving(false);
    }
  };

  const handleQueue = async (tripOrRoute) => {
    const routeLabel = typeof tripOrRoute === 'string' ? tripOrRoute : tripOrRoute.routeLabel;
    if (!(await ensureLocationSharing())) return;

    if (isWaiting && queuedRouteLabel === routeLabel) {
      setIsWaiting(false);
      setQueuedRouteLabel(null);
      await stopBroadcast({ removeFromDb: true });
      return;
    }

    setIsWaiting(true);
    setQueuedRouteLabel(routeLabel);
    setShareRouteLabel(routeLabel);
    if (passengerCoords && deviceId) {
      await upsertPassengerLocation(
        deviceId, null,
        passengerCoords.latitude, passengerCoords.longitude,
        routeLabel,
      ).catch(() => {});
    }
    await restartBroadcast(null, routeLabel);
    Alert.alert('In the queue', `Mates on ${routeLabel} can see you're waiting.`);
  };

  const clearReservation = async () => {
    if (activeReservationId && deviceId) {
      await cancelReservation(activeReservationId, deviceId).catch(() => {});
    }
    await clearActiveReservationCache();
    await stopBroadcast({ removeFromDb: true });
    setActiveReservationId(null);
    setReservedTrip(null);
    reservedTripRef.current = null;
    setReservationExpiresAt(null);
    setIsWaiting(false);
    setQueuedRouteLabel(null);
    setRideSheet(null);
  };

  const isActivePassenger = !!activeReservationId || isWaiting;

  const problemBannerPhase = useMemo(() => {
    if (isTrackingReserved || showRouteResults) return 'hidden';
    if (fromPlace && toPlace) return 'loading';
    return 'idle';
  }, [isTrackingReserved, showRouteResults, fromPlace, toPlace]);

  const headerSubtitle = useMemo(() => {
    if (showRouteResults && !isTrackingReserved) return 'Live trotros on your route';
    if (fromPlace && toPlace) return `${fromPlace} → ${toPlace}`;
    return PASSENGER.subtitleIdle;
  }, [fromPlace, toPlace, showRouteResults, isTrackingReserved]);

  const handleEditRoute = useCallback(() => {
    setFromPlace(null);
    setToPlace(null);
    setSelectedTripId(null);
    setRideSheet(null);
  }, []);

  return (
    <PremiumBackground variant="passenger">
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.main}>
        <BrandHeader
          title="TrotroOS"
          subtitle={headerSubtitle}
          variant="passenger"
          liveCount={fromPlace && toPlace ? displayTrips.length : liveTrips.length}
        />

      {isTrackingReserved ? (
        <Pressable
          onPress={() => setRideSheet({ mode: 'active', trip: displayReservedTrip ?? reservedTrip })}
          style={({ pressed }) => [styles.trackingCard, pressed && { opacity: 0.92 }]}>
          <View style={styles.trackingCardLeft}>
            <View style={styles.trackingIcon}>
              <Ionicons name="navigate" size={18} color={C.ACCENT} />
            </View>
            <View style={styles.trackingText}>
              <Text style={styles.trackingTitle}>Your reserved ride</Text>
              <Text style={styles.trackingSub} numberOfLines={1}>
                {reservedTrip.originStation} → {reservedTrip.destination}
              </Text>
              <Text style={styles.trackingMeta} numberOfLines={1}>
                {reservedTrip.plate ? `${reservedTrip.plate} · ` : ''}
                {reservedTrip.mateName ?? 'Mate'} · {reservedTrip.fare}
              </Text>
              {countdown ? (
                <Text style={styles.trackingCountdown}>{countdown}</Text>
              ) : null}
              {displayReservedTrip?.eta ? (
                <Text style={styles.trackingEta}>
                  Arrives in {displayReservedTrip.eta.label}
                </Text>
              ) : null}
            </View>
          </View>
          <View style={styles.trackingRight}>
            <View style={styles.trackingLive}>
              <View style={styles.trackingLiveDot} />
              <Text style={styles.trackingLiveText}>
                {reservedDriver ? 'Live' : 'Locating…'}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={C.TEXT_MUTED} />
          </View>
        </Pressable>
      ) : null}

      {/* ── Active status pill (hidden when tracking card already shows status) ─ */}
      {isActivePassenger && !isTrackingReserved ? (
        <View style={styles.statusPill}>
          <View style={styles.statusPillDot} />
          <Text style={styles.statusPillText} numberOfLines={1}>
            {activeReservationId
              ? (reservedDriver ? 'Tracking your car live on the map' : 'Seat reserved · waiting for driver GPS')
              : 'In queue · sharing location'}
          </Text>
          <Pressable onPress={clearReservation} hitSlop={10}>
            <Ionicons name="close-circle" size={18} color="#F87171" />
          </Pressable>
        </View>
      ) : null}

      {!isTrackingReserved && !showRouteResults ? (
      <ScrollView
        style={styles.idleScroll}
        contentContainerStyle={styles.idleScrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled">
      <PassengerProblemBanner
        phase={problemBannerPhase}
        liveCount={displayTrips.filter((t) => t.availableSeats > 0).length}
      />

      <RoutePlanner
        fromPlace={fromPlace}
        toPlace={toPlace}
        onChangeFrom={setFromPlace}
        onChangeTo={setToPlace}
        onSwap={handleSwapRoute}
        passengerCoords={passengerCoords}
      />
      </ScrollView>
      ) : null}

      {!isTrackingReserved && showRouteResults ? (
      <PassengerProblemBanner
        phase={problemBannerPhase}
        liveCount={displayTrips.filter((t) => t.availableSeats > 0).length}
      />
      ) : null}

      {/* ── Trip list (map stays OUTSIDE FlatList — MapView in ListHeader crashes Android) ─ */}
      {showRouteResults ? (
      <View style={styles.resultsPane}>
        <LiveRouteMap
          key="passenger-live-map"
          fromPlace={fromPlace ?? reservedTrip?.originStation}
          toPlace={toPlace ?? reservedTrip?.destination}
          passengerCoords={passengerCoords}
          enrichedTrips={enrichedTrips}
          selectedTripId={selectedTripId}
          reservedTrip={displayReservedTrip ?? reservedTrip}
          reservedDriver={reservedDriver}
          isTrackingReserved={isTrackingReserved}
          onSelectTrip={handleSelectTrip}
          onReserve={handleReserve}
        />
        <FlatList
          style={styles.list}
          data={enrichedTrips}
          keyExtractor={(item) => String(item.id)}
          removeClippedSubviews={false}
          nestedScrollEnabled={false}
          renderItem={({ item }) => (
            <RouteRideCard
              trip={item}
              eta={item.eta}
              demand={demandByRoute[item.routeLabel] ?? 0}
              rating={item.mateId ? mateAverages[item.mateId] : null}
              selected={selectedTripId === item.id}
              onSelect={handleSelectTrip}
              onViewDetails={handleViewDetails}
              onReserve={handleReserve}
              onQueue={handleQueue}
            />
          )}
          contentContainerStyle={[
            styles.listContent,
            selectedTrip && !activeReservationId && styles.listContentWithBar,
          ]}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <RouteResultsHeader
              fromPlace={fromPlace}
              toPlace={toPlace}
              rideCount={enrichedTrips.filter((t) => t.availableSeats > 0).length}
              routeSummary={routeEtaSummary}
              onEditRoute={handleEditRoute}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <View style={styles.emptyIcon}>
                <Ionicons name="bus-outline" size={36} color={C.TEXT_MUTED} />
              </View>
              <Text style={styles.emptyTitle}>No mates on this route yet</Text>
              <Text style={styles.emptySubtitle}>
                Join the queue for {fromPlace} → {toPlace} and mates will see you waiting.
                {selectedRouteMeta?.pickupEta ? (
                  `\nTypical wait: ${selectedRouteMeta.pickupEta.min}–${selectedRouteMeta.pickupEta.max} min`
                ) : ''}
              </Text>
              <Pressable
                onPress={() => handleQueue(selectedRouteLabel)}
                style={({ pressed }) => [
                  styles.queueRouteBtn,
                  isWaiting && queuedRouteLabel === selectedRouteLabel && styles.queueRouteBtnActive,
                  pressed && { opacity: 0.88 },
                ]}>
                <Ionicons name="time-outline" size={18} color={Theme.colors.passenger} />
                <Text style={styles.queueRouteBtnText}>
                  {isWaiting && queuedRouteLabel === selectedRouteLabel ? 'Leave queue' : "I'm waiting on this route"}
                </Text>
              </Pressable>
            </View>
        }
      />
      </View>
      ) : null}

      </View>

      {selectedTrip && !activeReservationId && fromPlace && toPlace ? (
        <View style={[styles.chooseBar, { bottom: TAB_BAR_CLEARANCE + 8 }]}>
          <View style={styles.chooseBarInfo}>
            <Text style={styles.chooseBarLabel}>Your chosen ride</Text>
            <Text style={styles.chooseBarTitle} numberOfLines={1}>
              {selectedTrip.mateName ?? 'Mate'}
              {selectedTrip.plate ? ` · ${selectedTrip.plate}` : ''}
            </Text>
            <View style={styles.chooseBarEta}>
              <Ionicons name="time-outline" size={14} color={Theme.colors.passenger} />
              <Text style={styles.chooseBarEtaText}>
                Arrives in {selectedTrip.eta?.label ?? '…'}
              </Text>
            </View>
          </View>
          <Pressable
            onPress={() => handleReserve(selectedTrip)}
            disabled={!deviceId || reserving}
            style={({ pressed }) => [
              styles.chooseBarBtn,
              (!deviceId || reserving) && styles.chooseBarBtnDisabled,
              pressed && deviceId && !reserving && { opacity: 0.9 },
            ]}>
            <Text style={styles.chooseBarBtnText}>
              {!deviceId ? 'Loading…' : PASSENGER.reserveCta}
            </Text>
            <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
          </Pressable>
        </View>
      ) : null}

      <RideDetailsSheet
        visible={rideSheet !== null}
        trip={
          rideSheet?.mode === 'active'
            ? (displayReservedTrip ?? rideSheet?.trip)
            : rideSheet?.trip
        }
        mode={rideSheet?.mode ?? 'preview'}
        rating={
          rideSheet?.trip?.mateId ? mateAverages[rideSheet.trip.mateId] : null
        }
        countdown={rideSheet?.mode === 'active' ? countdown : null}
        driverLive={!!reservedDriver}
        passengerCoords={passengerCoords}
        driverCoords={
          rideSheet?.mode === 'active' && reservedDriver
            ? { latitude: reservedDriver.latitude, longitude: reservedDriver.longitude }
            : rideSheet?.trip?.driverCoords ?? null
        }
        pickupEta={rideSheet?.trip?.eta ?? selectedTrip?.eta}
        routeMeta={
          rideSheet?.trip
            ? findRouteByPlaces(rideSheet.trip.originStation, rideSheet.trip.destination)
            : selectedRouteMeta
        }
        onClose={closeRideSheet}
        onReserve={handleConfirm}
        onCancel={() => {
          Alert.alert(
            'Cancel reservation?',
            'Your seat will be released for other passengers.',
            [
              { text: 'Keep ride', style: 'cancel' },
              { text: 'Cancel ride', style: 'destructive', onPress: clearReservation },
            ],
          );
        }}
        onTrackMap={() => {
          closeRideSheet();
        }}
        reserving={reserving}
        reserveReady={!!deviceId}
      />

      <RatingModal
        visible={!!pendingRating}
        trip={pendingRating?.trip}
        mateName={pendingRating?.mateName}
        onSkip={() => setPendingRating(null)}
        onSubmit={async ({ stars, comment }) => {
          let passengerId = deviceId;
          if (!passengerId) {
            passengerId = await getOrCreateDeviceId();
            if (mountedRef.current) setDeviceId(passengerId);
          }
          if (!pendingRating?.tripId || !passengerId) {
            throw new Error('Still loading your profile. Wait a second and try again.');
          }
          if (!pendingRating.mateId) {
            throw new Error('This trip has no mate to rate.');
          }

          const { error } = await submitRating(
            pendingRating.tripId,
            pendingRating.mateId,
            passengerId,
            stars,
            comment,
          );
          if (error) {
            const msg = error.message ?? '';
            if (msg.includes('duplicate') || msg.includes('unique')) {
              setPendingRating(null);
              Alert.alert('Already rated', 'You already rated this trip.');
              return;
            }
            if (msg.includes('ratings') && (msg.includes('schema cache') || msg.includes('PGRST205'))) {
              throw new Error('Ratings are not set up on the server yet.');
            }
            throw new Error(msg || 'Could not save rating.');
          }
          setPendingRating(null);
          Alert.alert('Thanks!', 'Your rating helps other riders find great mates.');
        }}
      />
    </SafeAreaView>
    </PremiumBackground>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: 'transparent' },
  main: { flex: 1 },
  idleScroll: { flexGrow: 0 },
  idleScrollContent: { paddingBottom: 12 },

  // Header
  header:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12 },
  headerLogo:   { color: C.TEXT, fontSize: 22, fontWeight: '800', letterSpacing: -0.5 },
  headerTagline:{ color: C.TEXT_MUTED, fontSize: 12, fontWeight: '500', marginTop: 1 },
  headerRight:  { flexDirection: 'row', alignItems: 'center', gap: 10 },

  liveIndicator:    { flexDirection: 'row', alignItems: 'center', backgroundColor: C.SUCCESS_SOFT, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5, gap: 6 },
  liveDotPulse:     { width: 6, height: 6, borderRadius: 3, backgroundColor: C.SUCCESS },
  liveIndicatorText:{ color: C.SUCCESS, fontSize: 12, fontWeight: '700' },

  mapToggle:       { width: 38, height: 38, borderRadius: 12, backgroundColor: C.SURFACE, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.BORDER },
  mapToggleActive: { backgroundColor: C.ACCENT_SOFT, borderColor: C.ACCENT + '55' },

  // Status pill
  statusPill:     { flexDirection: 'row', alignItems: 'center', marginHorizontal: SCREEN_GUTTER, marginBottom: 10, backgroundColor: 'rgba(34,197,94,0.1)', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, gap: 8, borderWidth: 1, borderColor: 'rgba(34,197,94,0.2)' },
  statusPillDot:  { width: 7, height: 7, borderRadius: 4, backgroundColor: C.SUCCESS },
  statusPillText: { flex: 1, color: '#86efac', fontSize: 12, fontWeight: '600' },

  trackingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: SCREEN_GUTTER,
    marginBottom: 10,
    backgroundColor: C.SURFACE,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: C.ACCENT + '50',
  },
  trackingCardLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1, paddingRight: 10 },
  trackingIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: C.ACCENT_SOFT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trackingText: { flex: 1 },
  trackingTitle: { color: C.TEXT, fontSize: 14, fontWeight: '800' },
  trackingSub: { color: C.TEXT, fontSize: 13, fontWeight: '700', marginTop: 2 },
  trackingMeta: { color: C.TEXT_SUB, fontSize: 11, marginTop: 2 },
  trackingCountdown: { color: '#FBBF24', fontSize: 11, fontWeight: '700', marginTop: 4 },
  trackingEta: { color: Theme.colors.passenger, fontSize: 11, fontWeight: '700', marginTop: 2 },
  trackingRight: { alignItems: 'flex-end', gap: 8 },
  trackingLive: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.SUCCESS_SOFT, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  trackingLiveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.SUCCESS },
  trackingLiveText: { color: C.SUCCESS, fontSize: 11, fontWeight: '800' },

  // Search
  searchRow:    { paddingHorizontal: 20, marginBottom: 14 },

  pickRouteHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 20,
    marginBottom: 16,
    padding: 14,
    borderRadius: Theme.radius.md,
    backgroundColor: Theme.colors.passengerSoft,
    borderWidth: 1,
    borderColor: Theme.colors.passenger + '33',
  },
  pickRouteHintText: { flex: 1, color: Theme.colors.textSub, fontSize: 13, fontWeight: '600', lineHeight: 18 },

  routeReadyHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 20,
    marginBottom: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: Theme.radius.md,
    backgroundColor: Theme.colors.successSoft,
    borderWidth: 1,
    borderColor: Theme.colors.success + '33',
  },
  routeReadyHintText: { flex: 1, color: Theme.colors.success, fontSize: 12, fontWeight: '700' },

  routeLoadingHint: {
    marginHorizontal: 20,
    marginBottom: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  routeLoadingText: { color: Theme.colors.textSub, fontSize: 12, fontWeight: '600' },

  listContentWithBar: { paddingBottom: TAB_FOOTER_CLEARANCE + 72 },

  chooseBar: {
    position: 'absolute',
    left: SCREEN_GUTTER,
    right: SCREEN_GUTTER,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: C.SURFACE,
    borderRadius: 18,
    padding: 14,
    borderWidth: 1.5,
    borderColor: Theme.colors.passenger + '66',
    shadowColor: Theme.colors.passenger,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
    zIndex: 20,
  },
  chooseBarInfo: { flex: 1 },
  chooseBarLabel: { color: C.TEXT_MUTED, fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  chooseBarTitle: { color: C.TEXT, fontSize: 15, fontWeight: '800', marginTop: 2 },
  chooseBarEta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  chooseBarEtaText: { color: Theme.colors.passenger, fontSize: 12, fontWeight: '700' },
  chooseBarBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 48,
    backgroundColor: Theme.colors.passenger,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  chooseBarBtnDisabled: {
    opacity: 0.45,
  },
  chooseBarBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },

  routeFlowRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  routeFrom: { color: Theme.colors.text, fontSize: 17, fontWeight: '800', flexShrink: 1 },
  routeTo: { color: Theme.colors.passenger, fontSize: 17, fontWeight: '800', flexShrink: 1 },

  queueRouteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 20,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: Theme.radius.lg,
    borderWidth: 1.5,
    borderColor: Theme.colors.passenger,
    backgroundColor: Theme.colors.passengerSoft,
  },
  queueRouteBtnActive: { backgroundColor: Theme.colors.passenger + '22' },
  queueRouteBtnText: { color: Theme.colors.passenger, fontSize: 15, fontWeight: '800' },

  // List
  resultsPane:   { flex: 1 },
  list:          { flex: 1 },
  listContent:   { paddingHorizontal: SCREEN_GUTTER, paddingBottom: TAB_BAR_CLEARANCE },
  sectionHeader: { paddingVertical: 10 },
  sectionHeaderText: { color: C.TEXT_MUTED, fontSize: 11, fontWeight: '700', letterSpacing: 1 },

  // Cards
  card:         { flexDirection: 'row', backgroundColor: C.SURFACE, borderRadius: 16, marginBottom: 12, overflow: 'hidden', borderWidth: 1, borderColor: C.BORDER },
  cardAccent:   { width: 4, borderTopLeftRadius: 16, borderBottomLeftRadius: 16 },
  cardInner:    { flex: 1, padding: 16 },
  cardTopRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  cardHeaderText: { flex: 1, paddingRight: 12 },
  destinationRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  destination:  { color: C.TEXT, fontSize: 20, fontWeight: '800', letterSpacing: -0.3, flexShrink: 1 },
  livePulse:    { width: 7, height: 7, borderRadius: 4 },
  origin:       { color: C.TEXT_SUB, fontSize: 13, marginTop: 4 },
  departure:    { color: C.TEXT_SUB, fontSize: 12, marginTop: 3 },

  badge:        { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, borderWidth: 1, alignSelf: 'flex-start' },
  badgeText:    { fontSize: 12, fontWeight: '700' },

  cardDivider:  { height: 1, backgroundColor: C.BORDER, marginVertical: 12 },

  demandChip:   { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(251,191,36,0.12)', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3, marginTop: 6, borderWidth: 1, borderColor: 'rgba(251,191,36,0.25)' },
  demandText:   { color: '#FBBF24', fontSize: 11, fontWeight: '700' },

  ratingPill:   { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: 'rgba(251,191,36,0.12)', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, marginLeft: 6, borderWidth: 1, borderColor: 'rgba(251,191,36,0.25)' },
  ratingText:   { color: '#FBBF24', fontSize: 10, fontWeight: '800' },


  mateRow:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 12 },
  mateIconRow:     { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 },
  mateAvatar:      { width: 22, height: 22, borderRadius: 11, backgroundColor: C.ACCENT_SOFT, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.ACCENT + '40' },
  mateName:        { color: C.TEXT, fontSize: 13, fontWeight: '700', flexShrink: 1 },
  mateBadges:      { flexDirection: 'row', gap: 6 },
  vehicleTypePill: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderColor: C.BORDER },
  vehicleTypeText: { color: C.TEXT_SUB, fontSize: 11, fontWeight: '600' },
  platePill:       { backgroundColor: '#0C0C0C', borderRadius: 6, paddingHorizontal: 9, paddingVertical: 4, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
  plateText:       { color: C.TEXT, fontSize: 11.5, fontWeight: '800', letterSpacing: 1.2, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },

  cardBottomRow:{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardActions:  { flexDirection: 'row', gap: 8 },
  fare:         { color: C.ACCENT, fontSize: 15, fontWeight: '800' },
  fareNote:     { color: C.TEXT_MUTED, fontSize: 13, fontWeight: '500' },

  detailsButton:     { borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1, borderColor: C.BORDER, backgroundColor: C.SURFACE_UP },
  detailsButtonText: { color: C.TEXT_SUB, fontSize: 13, fontWeight: '700' },
  reserveButton:     { backgroundColor: C.ACCENT, borderRadius: 10, paddingHorizontal: 18, paddingVertical: 10, alignItems: 'center', justifyContent: 'center' },
  reserveButtonFull: { backgroundColor: C.TEXT_MUTED },
  reserveButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  queueButton:       { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1.5, borderColor: C.ACCENT },
  queueButtonText:   { color: C.ACCENT, fontSize: 13, fontWeight: '700' },

  // Empty
  emptyState:    { alignItems: 'center', paddingTop: 72, gap: 12 },
  emptyIcon:     { width: 72, height: 72, borderRadius: 24, backgroundColor: C.SURFACE, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.BORDER },
  emptyTitle:    { color: C.TEXT, fontSize: 17, fontWeight: '700' },
  emptySubtitle: { color: C.TEXT_MUTED, fontSize: 14, textAlign: 'center', maxWidth: 280, lineHeight: 20 },
  routeQueueGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 20, justifyContent: 'center' },
  routeQueueChip: {
    width: '46%',
    backgroundColor: C.SURFACE,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: C.BORDER,
  },
  routeQueueChipActive: { borderColor: C.ACCENT + '80', backgroundColor: C.ACCENT_SOFT },
  routeQueueText: { color: C.TEXT, fontSize: 14, fontWeight: '700' },
  routeQueueTextActive: { color: C.ACCENT },
  routeQueueMeta: { color: C.TEXT_MUTED, fontSize: 11, marginTop: 4, fontWeight: '600' },

  // Modal
  modalBackdrop:    { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' },
  modalSheet:       { backgroundColor: C.SURFACE, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 24, paddingTop: 12, paddingBottom: 40 },
  modalHandle:      { width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.15)', alignSelf: 'center', marginBottom: 24 },

  modalRouteRow:    { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 6 },
  modalRouteDot:    { width: 10, height: 10, borderRadius: 5, backgroundColor: C.ACCENT },
  modalRouteDotDest:{ backgroundColor: C.TEXT },
  modalRouteLine:   { width: 2, height: 24, backgroundColor: C.BORDER, marginLeft: 4, marginBottom: 6 },
  modalOrigin:      { color: C.TEXT_SUB, fontSize: 15, fontWeight: '600' },
  modalDest:        { color: C.TEXT, fontSize: 22, fontWeight: '800', letterSpacing: -0.3 },
  modalDivider:     { height: 1, backgroundColor: C.BORDER, marginVertical: 20 },

  modalMateCard:    { flexDirection: 'row', alignItems: 'center', backgroundColor: C.SURFACE_UP, borderRadius: 14, padding: 14, gap: 12, marginBottom: 20, borderWidth: 1, borderColor: C.BORDER },
  modalMateAvatar:  { width: 42, height: 42, borderRadius: 12, backgroundColor: C.ACCENT_SOFT, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.ACCENT + '40' },
  modalMateInfo:    { flex: 1, minWidth: 0 },
  modalMateLabel:   { color: C.TEXT_MUTED, fontSize: 10, fontWeight: '700', letterSpacing: 1 },
  modalMateName:    { color: C.TEXT, fontSize: 15, fontWeight: '800', marginTop: 2 },
  modalVehicleType: { color: C.TEXT_SUB, fontSize: 12, fontWeight: '500', marginTop: 1 },
  modalPlate:       { backgroundColor: '#0C0C0C', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
  modalPlateText:   { color: C.TEXT, fontSize: 13, fontWeight: '800', letterSpacing: 1.2, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },

  modalMeta:        { gap: 12, marginBottom: 24 },
  modalMetaItem:    { flexDirection: 'row', alignItems: 'center', gap: 10 },
  modalMetaText:    { color: C.TEXT_SUB, fontSize: 14, fontWeight: '500' },

  confirmButton:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: C.ACCENT, borderRadius: 14, minHeight: 56, shadowColor: C.ACCENT, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 12 },
  confirmButtonDisabled: { backgroundColor: C.TEXT_MUTED },
  confirmButtonText:     { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  cancelLink:            { alignItems: 'center', paddingVertical: 14 },
  cancelLinkText:        { color: C.TEXT_MUTED, fontSize: 15, fontWeight: '600' },
});
