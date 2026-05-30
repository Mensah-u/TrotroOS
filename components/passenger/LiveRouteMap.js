import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  InteractionManager,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import SafeMapView, { canUseNativeMap, SafeCallout, SafeMarker, SafePolyline } from '@/components/SafeMapView';
import InteractiveWebMap from '@/components/InteractiveWebMap';
import { GOOGLE_MAPS_WEB_KEY } from '@/constants/config';
import PulsingMapMarker from '@/components/PulsingMapMarker';
import MapClusterMarker from '@/components/MapClusterMarker';
import StaticMapDot from '@/components/StaticMapDot';

import { getPlaceCoords } from '@/services/staticData';
import { SCREEN_GUTTER } from '@/constants/layout';
import { darkMapStyle, Theme, getSeatStatus, glowShadow } from '@/constants/theme';
import { hapticSelect } from '@/utils/haptics';
import useViewportClusters from '@/hooks/useViewportClusters';
import { regionForCluster } from '@/utils/clustering';

const MAP_INITIAL_REGION = {
  latitude: 6.673,
  longitude: -1.565,
  latitudeDelta: 0.05,
  longitudeDelta: 0.05,
};

/** Animated / nested marker views inside MapView crash Android (addViewAt). */
const ANDROID_SAFE_MAP = Platform.OS === 'android';
const USE_WEB_GOOGLE_MAP = Platform.OS === 'web' && Boolean(GOOGLE_MAPS_WEB_KEY?.trim());
const MARKER_TRACKS_CHANGES = !ANDROID_SAFE_MAP;
const ANDROID_MARKER_LIMIT = 30;

function PlaceMarker({ coordinate, label, variant }) {
  const isFrom = variant === 'from';
  const color = isFrom ? Theme.colors.success : Theme.colors.passenger;

  if (ANDROID_SAFE_MAP) {
    return (
      <SafeMarker
        coordinate={coordinate}
        anchor={{ x: 0.5, y: 0.5 }}
        tracksViewChanges={false}
        title={isFrom ? `Pickup: ${label}` : `Destination: ${label}`}
        zIndex={10}>
        <StaticMapDot color={color} size={24} />
      </SafeMarker>
    );
  }

  return (
    <SafeMarker coordinate={coordinate} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={false} zIndex={10}>
      <View style={[styles.placeMarker, isFrom ? styles.placeFrom : styles.placeTo]}>
        <Ionicons name={isFrom ? 'radio-button-on' : 'flag'} size={14} color="#FFFFFF" />
      </View>
      <SafeCallout tooltip>
        <View style={styles.calloutCard}>
          <Text style={styles.calloutLabel}>{isFrom ? 'PICKUP' : 'DESTINATION'}</Text>
          <Text style={styles.calloutRoute}>{label}</Text>
        </View>
      </SafeCallout>
    </SafeMarker>
  );
}

function ReservedVehicleMarker({ driver, trip }) {
  if (ANDROID_SAFE_MAP) {
    return (
      <SafeMarker
        coordinate={{ latitude: driver.latitude, longitude: driver.longitude }}
        anchor={{ x: 0.5, y: 0.5 }}
        tracksViewChanges={false}
        title="Your ride"
        description={trip?.plate ?? trip?.mateName ?? undefined}
        zIndex={999}>
        <StaticMapDot color={Theme.colors.mateMap} size={28} />
      </SafeMarker>
    );
  }

  return (
    <SafeMarker
      coordinate={{ latitude: driver.latitude, longitude: driver.longitude }}
      anchor={{ x: 0.5, y: 0.5 }}
      tracksViewChanges={MARKER_TRACKS_CHANGES}
      zIndex={999}>
      <PulsingMapMarker
        color={Theme.colors.mateMap}
        size={44}
        icon="bus"
        label="YOUR RIDE"
      />
      <SafeCallout tooltip>
        <View style={styles.calloutCard}>
          <View style={styles.yourRideBadge}>
            <Text style={styles.yourRideBadgeText}>YOUR RIDE</Text>
          </View>
          <Text style={styles.calloutRoute} numberOfLines={1}>
            {trip?.originStation} → {trip?.destination}
          </Text>
          {trip?.mateName ? <Text style={styles.calloutMeta}>{trip.mateName}</Text> : null}
          {trip?.plate ? <Text style={styles.calloutPlate}>{trip.plate}</Text> : null}
          {trip?.eta ? <Text style={styles.calloutEta}>Arrives in {trip.eta.label}</Text> : null}
        </View>
      </SafeCallout>
    </SafeMarker>
  );
}

function RideMarker({ driver, trip, selected, dimmed, onSelect, onReserve }) {
  const { color: baseColor } = getSeatStatus(driver.available_seats);
  const isFull = driver.available_seats === 0;

  if (ANDROID_SAFE_MAP) {
    return (
      <SafeMarker
        coordinate={{ latitude: driver.latitude, longitude: driver.longitude }}
        anchor={{ x: 0.5, y: 0.5 }}
        tracksViewChanges={false}
        opacity={dimmed ? 0.45 : 1}
        title={trip?.mateName ?? 'Mate'}
        description={isFull ? 'Full' : `${driver.available_seats} seats`}
        zIndex={selected ? 100 : 50}
        onPress={() => trip && onSelect?.(trip)}>
        <StaticMapDot color={baseColor} size={selected ? 26 : 22} />
      </SafeMarker>
    );
  }

  return (
    <SafeMarker
      coordinate={{ latitude: driver.latitude, longitude: driver.longitude }}
      anchor={{ x: 0.5, y: 0.5 }}
      tracksViewChanges={MARKER_TRACKS_CHANGES && !dimmed}
      opacity={dimmed ? 0.45 : 1}
      zIndex={selected ? 100 : 50}
      onPress={() => trip && onSelect?.(trip)}>
      <View>
        <PulsingMapMarker
          color={baseColor}
          size={selected ? 40 : 34}
          icon="bus"
          selected={selected}
          ringOpacity={isFull ? 0.18 : selected ? 0.55 : 0.32}
          ringScaleTo={selected ? 2.6 : 2.1}
        />
        {!isFull ? (
          <View style={styles.seatBadgeFloating}>
            <Text style={styles.seatBadgeText}>{driver.available_seats}</Text>
          </View>
        ) : null}
      </View>
      <SafeCallout tooltip onPress={() => trip && !isFull && onReserve?.(trip)}>
        <View style={styles.calloutCard}>
          <Text style={styles.calloutRoute} numberOfLines={1}>
            {trip?.originStation} → {trip?.destination}
          </Text>
          {trip?.mateName ? <Text style={styles.calloutMeta}>{trip.mateName}</Text> : null}
          {trip?.plate ? <Text style={styles.calloutPlate}>{trip.plate}</Text> : null}
          {trip?.eta ? <Text style={styles.calloutEta}>Arrives in {trip.eta.label}</Text> : null}
          <Text style={[styles.calloutSeats, isFull && { color: Theme.colors.error }]}>
            {isFull ? 'Full' : `${driver.available_seats} seats · Tap to choose`}
          </Text>
        </View>
      </SafeCallout>
    </SafeMarker>
  );
}

function MapCanvas({
  mapRef,
  fromPlace,
  toPlace,
  originCoords,
  destCoords,
  passengerCoords,
  ridesOnMap,
  selectedTripId,
  reservedTrip,
  reservedDriver,
  isTrackingReserved,
  onSelectTrip,
  onReserve,
  style,
}) {
  const routeLine = useMemo(() => {
    if (!originCoords || !destCoords) return [];
    return [originCoords, destCoords];
  }, [originCoords, destCoords]);

  const initialRegion = useMemo(() => {
    if (passengerCoords) {
      return { ...passengerCoords, latitudeDelta: 0.04, longitudeDelta: 0.04 };
    }
    if (originCoords) {
      return { ...originCoords, latitudeDelta: 0.04, longitudeDelta: 0.04 };
    }
    return MAP_INITIAL_REGION;
  }, [passengerCoords, originCoords]);

  // Viewport-aware clustering for the ride markers.
  // The reserved ride (if any) is pinned via `alwaysShow` so it never
  // collapses into a cluster — passengers always need to see their car.
  const rideMarkerInputs = useMemo(
    () =>
      ridesOnMap
        .filter((r) => r.driverCoords?.latitude != null)
        .map((r) => ({
          id: r.id,
          latitude: r.driverCoords.latitude,
          longitude: r.driverCoords.longitude,
          data: r,
        })),
    [ridesOnMap],
  );

  const alwaysShowIds = useMemo(() => {
    if (!isTrackingReserved || !reservedTrip?.tripId) return null;
    return [reservedTrip.tripId];
  }, [isTrackingReserved, reservedTrip?.tripId]);

  const { onRegionChange, onLayout, clusters } = useViewportClusters(rideMarkerInputs, {
    initialRegion,
    gridSizePx: 72,
    minPoints: 3,
    alwaysShow: alwaysShowIds,
  });

  const onClusterPress = useCallback((cluster) => {
    if (!canUseNativeMap() || !mapRef?.current) return;
    const next = regionForCluster(cluster);
    if (next) mapRef.current.animateToRegion(next, 350);
  }, [mapRef]);

  const lastCameraMoveRef = useRef(0);
  const CAMERA_MIN_INTERVAL_MS = 4000;

  useEffect(() => {
    if (!canUseNativeMap() || !mapRef?.current) return;

    const now = Date.now();
    if (now - lastCameraMoveRef.current < CAMERA_MIN_INTERVAL_MS) return;
    lastCameraMoveRef.current = now;

    const points = [];
    if (passengerCoords) points.push(passengerCoords);
    if (originCoords) points.push(originCoords);
    if (destCoords) points.push(destCoords);
    for (const ride of ridesOnMap) {
      if (ride.driverCoords) points.push(ride.driverCoords);
    }
    if (reservedDriver) {
      points.push({ latitude: reservedDriver.latitude, longitude: reservedDriver.longitude });
    }

    if (points.length === 0) return;

    if (isTrackingReserved && reservedDriver?.latitude != null) {
      mapRef.current.animateToRegion(
        {
          latitude: reservedDriver.latitude,
          longitude: reservedDriver.longitude,
          latitudeDelta: 0.018,
          longitudeDelta: 0.018,
        },
        500,
      );
      return;
    }

    if (points.length === 1) {
      mapRef.current.animateToRegion(
        { ...points[0], latitudeDelta: 0.03, longitudeDelta: 0.03 },
        600,
      );
      return;
    }

    mapRef.current.fitToCoordinates(points, {
      edgePadding: { top: 48, right: 48, bottom: 48, left: 48 },
      animated: true,
    });
  }, [
    mapRef,
    fromPlace,
    toPlace,
    passengerCoords,
    originCoords,
    destCoords,
    reservedDriver,
    ridesOnMap,
    isTrackingReserved,
  ]);

  useEffect(() => {
    if (!canUseNativeMap() || !selectedTripId || !mapRef?.current || isTrackingReserved) return;
    const ride = ridesOnMap.find((r) => r.id === selectedTripId);
    if (!ride?.driverCoords) return;
    mapRef.current.animateToRegion(
      { ...ride.driverCoords, latitudeDelta: 0.018, longitudeDelta: 0.018 },
      500,
    );
  }, [selectedTripId, ridesOnMap, mapRef, isTrackingReserved]);

  const rideMarkers = useMemo(() => {
    if (ANDROID_SAFE_MAP) {
      return ridesOnMap
        .filter((ride) => ride.driverCoords?.latitude != null)
        .filter((ride) => !(isTrackingReserved && ride.mateId === reservedTrip?.mateId))
        .slice(0, ANDROID_MARKER_LIMIT)
        .map((ride) => (
          <RideMarker
            key={String(ride.id)}
            driver={{
              latitude: ride.driverCoords.latitude,
              longitude: ride.driverCoords.longitude,
              available_seats: ride.availableSeats,
            }}
            trip={ride}
            selected={selectedTripId === ride.id}
            dimmed={isTrackingReserved}
            onSelect={onSelectTrip}
            onReserve={onReserve}
          />
        ));
    }

    const nodes = [];
    for (const c of clusters) {
      if (c.isCluster) {
        nodes.push(
          <SafeMarker
            key={c.id}
            coordinate={{ latitude: c.latitude, longitude: c.longitude }}
            anchor={{ x: 0.5, y: 0.5 }}
            tracksViewChanges={false}
            zIndex={60}
            onPress={() => onClusterPress(c)}>
            <MapClusterMarker count={c.count} color={Theme.colors.mate} />
          </SafeMarker>,
        );
        continue;
      }
      const ride = c.marker?.data;
      if (!ride?.driverCoords?.latitude) continue;
      if (isTrackingReserved && ride.mateId === reservedTrip?.mateId) continue;
      nodes.push(
        <RideMarker
          key={String(ride.id ?? ride.mateId ?? c.id)}
          driver={{
            latitude: ride.driverCoords.latitude,
            longitude: ride.driverCoords.longitude,
            available_seats: ride.availableSeats,
          }}
          trip={ride}
          selected={selectedTripId === ride.id}
          dimmed={isTrackingReserved}
          onSelect={onSelectTrip}
          onReserve={onReserve}
        />,
      );
    }
    return nodes;
  }, [
    clusters,
    ridesOnMap,
    isTrackingReserved,
    reservedTrip?.mateId,
    selectedTripId,
    onSelectTrip,
    onReserve,
    onClusterPress,
  ]);

  const webMarkers = useMemo(() => {
    if (!USE_WEB_GOOGLE_MAP) return [];
    const items = [];
    if (originCoords) {
      items.push({
        id: 'origin',
        lat: originCoords.latitude,
        lng: originCoords.longitude,
        color: Theme.colors.success,
        scale: 8,
        title: fromPlace,
        zIndex: 10,
      });
    }
    if (destCoords) {
      items.push({
        id: 'dest',
        lat: destCoords.latitude,
        lng: destCoords.longitude,
        color: Theme.colors.passenger,
        scale: 8,
        title: toPlace,
        zIndex: 10,
      });
    }
    if (passengerCoords) {
      items.push({
        id: 'you',
        lat: passengerCoords.latitude,
        lng: passengerCoords.longitude,
        color: Theme.colors.passengerMap,
        scale: 10,
        label: 'You',
        title: 'You',
        zIndex: 200,
      });
    }
    if (isTrackingReserved && reservedDriver?.latitude != null) {
      items.push({
        id: 'reserved',
        lat: reservedDriver.latitude,
        lng: reservedDriver.longitude,
        color: Theme.colors.mateMap,
        scale: 13,
        title: reservedTrip?.plate ?? 'Your ride',
        zIndex: 999,
      });
    }
    for (const ride of ridesOnMap) {
      if (isTrackingReserved && ride.mateId === reservedTrip?.mateId) continue;
      if (!ride.driverCoords?.latitude) continue;
      items.push({
        id: String(ride.id),
        lat: ride.driverCoords.latitude,
        lng: ride.driverCoords.longitude,
        color: selectedTripId === ride.id ? Theme.colors.passenger : Theme.colors.mateMap,
        scale: selectedTripId === ride.id ? 12 : 9,
        title: ride.plate ?? ride.mateName ?? 'Vehicle',
        zIndex: selectedTripId === ride.id ? 100 : 50,
        onPress: () => onSelectTrip(ride),
      });
    }
    return items;
  }, [
    originCoords,
    destCoords,
    passengerCoords,
    ridesOnMap,
    isTrackingReserved,
    reservedDriver,
    reservedTrip,
    selectedTripId,
    fromPlace,
    toPlace,
    onSelectTrip,
  ]);

  if (USE_WEB_GOOGLE_MAP) {
    return (
      <InteractiveWebMap
        ref={mapRef}
        style={style ?? StyleSheet.absoluteFill}
        initialRegion={initialRegion}
        markers={webMarkers}
        polyline={routeLine}
      />
    );
  }

  return (
    <SafeMapView
      ref={mapRef}
      style={style ?? StyleSheet.absoluteFill}
      initialRegion={initialRegion}
      customMapStyle={darkMapStyle}
      showsCompass={false}
      showsUserLocation={false}
      rotateEnabled={false}
      onLayout={onLayout}
      onRegionChangeComplete={ANDROID_SAFE_MAP ? undefined : onRegionChange}>
      {routeLine.length === 2 ? (
        <SafePolyline
          coordinates={routeLine}
          strokeColor={Theme.colors.passenger + '88'}
          strokeWidth={3}
          lineDashPattern={ANDROID_SAFE_MAP ? undefined : [8, 6]}
        />
      ) : null}

      {originCoords ? (
        <PlaceMarker coordinate={originCoords} label={fromPlace} variant="from" />
      ) : null}
      {destCoords ? (
        <PlaceMarker coordinate={destCoords} label={toPlace} variant="to" />
      ) : null}

      {passengerCoords ? (
        ANDROID_SAFE_MAP ? (
          <SafeMarker
            coordinate={passengerCoords}
            anchor={{ x: 0.5, y: 0.5 }}
            tracksViewChanges={false}
            title="You"
            zIndex={200}>
            <StaticMapDot color={Theme.colors.passengerMap} size={24} />
          </SafeMarker>
        ) : (
          <SafeMarker
            coordinate={passengerCoords}
            anchor={{ x: 0.5, y: 0.5 }}
            tracksViewChanges={false}
            zIndex={200}>
            <PulsingMapMarker
              color={Theme.colors.passengerMap}
              size={36}
              icon="person"
              label="YOU"
            />
          </SafeMarker>
        )
      ) : null}

      {isTrackingReserved && reservedDriver ? (
        <ReservedVehicleMarker driver={reservedDriver} trip={reservedTrip} />
      ) : null}

      {rideMarkers}
    </SafeMapView>
  );
}

export default function LiveRouteMap({
  fromPlace,
  toPlace,
  passengerCoords,
  enrichedTrips = [],
  selectedTripId,
  reservedTrip,
  reservedDriver,
  isTrackingReserved,
  onSelectTrip,
  onReserve,
  compact = false,
}) {
  const mapRef = useRef(null);
  const fullscreenMapRef = useRef(null);
  const [expanded, setExpanded] = useState(false);
  const [mapReady, setMapReady] = useState(!ANDROID_SAFE_MAP || USE_WEB_GOOGLE_MAP);

  useEffect(() => {
    if (!ANDROID_SAFE_MAP) return;
    let cancelled = false;
    let timer;
    const task = InteractionManager.runAfterInteractions(() => {
      timer = setTimeout(() => {
        if (!cancelled) setMapReady(true);
      }, 450);
    });
    return () => {
      cancelled = true;
      task.cancel();
      if (timer) clearTimeout(timer);
    };
  }, []);

  const originCoords = useMemo(() => getPlaceCoords(fromPlace), [fromPlace]);
  const destCoords = useMemo(() => getPlaceCoords(toPlace), [toPlace]);

  const ridesOnMap = useMemo(
    () => enrichedTrips.filter((t) => t.driverCoords?.latitude),
    [enrichedTrips],
  );

  const liveCount = ridesOnMap.length;
  const mapHeight = compact ? 200 : isTrackingReserved ? 300 : 260;

  const recenter = () => {
    hapticSelect();
    if (!canUseNativeMap()) return;
    const ref = expanded ? fullscreenMapRef : mapRef;
    if (!ref.current) return;

    const points = [];
    if (passengerCoords) points.push(passengerCoords);
    if (originCoords) points.push(originCoords);
    if (destCoords) points.push(destCoords);
    for (const ride of ridesOnMap) {
      if (ride.driverCoords) points.push(ride.driverCoords);
    }
    if (reservedDriver) {
      points.push({ latitude: reservedDriver.latitude, longitude: reservedDriver.longitude });
    }

    if (points.length === 0) return;
    if (points.length === 1) {
      ref.current.animateToRegion({ ...points[0], latitudeDelta: 0.03, longitudeDelta: 0.03 }, 600);
      return;
    }
    ref.current.fitToCoordinates(points, {
      edgePadding: { top: 60, right: 60, bottom: 60, left: 60 },
      animated: true,
    });
  };

  const mapProps = {
    fromPlace,
    toPlace,
    originCoords,
    destCoords,
    passengerCoords,
    ridesOnMap,
    selectedTripId,
    reservedTrip,
    reservedDriver,
    isTrackingReserved,
    onSelectTrip,
    onReserve,
  };

  return (
    <>
      <View style={[styles.wrap, isTrackingReserved && styles.wrapTracking, ANDROID_SAFE_MAP && styles.wrapAndroid]}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.liveDot} />
            <Text style={styles.headerTitle}>Live map</Text>
            <View style={styles.liveBadge}>
              <Text style={styles.liveBadgeText}>
                {liveCount > 0 ? `${liveCount} on route` : 'Scanning…'}
              </Text>
            </View>
          </View>
          <View style={styles.headerActions}>
            <Pressable onPress={recenter} style={styles.iconBtn} hitSlop={8}>
              <Ionicons name="locate" size={18} color={Theme.colors.passenger} />
            </Pressable>
            <Pressable
              onPress={() => { hapticSelect(); setExpanded(true); }}
              style={styles.iconBtn}
              hitSlop={8}>
              <Ionicons name="expand" size={18} color={Theme.colors.textSub} />
            </Pressable>
          </View>
        </View>

        <View style={[styles.mapBox, { height: mapHeight }]} collapsable={false}>
          {mapReady && !expanded ? (
            <MapCanvas mapRef={mapRef} {...mapProps} />
          ) : !mapReady ? (
            <View style={styles.mapPlaceholder}>
              <Text style={styles.mapPlaceholderText}>Loading map…</Text>
            </View>
          ) : null}

          <View style={styles.legend} pointerEvents="none">
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: Theme.colors.success }]} />
              <Text style={styles.legendText}>Pickup</Text>
            </View>
            <View style={styles.legendDivider} />
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: Theme.colors.mateMap }]} />
              <Text style={styles.legendText}>Trotro</Text>
            </View>
            <View style={styles.legendDivider} />
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: Theme.colors.passengerMap }]} />
              <Text style={styles.legendText}>You</Text>
            </View>
          </View>

          {liveCount === 0 && !isTrackingReserved ? (
            <View style={styles.emptyOverlay} pointerEvents="none">
              <View style={styles.emptyPill}>
                <Ionicons name="bus-outline" size={14} color={Theme.colors.textSub} />
                <Text style={styles.emptyText}>No live vehicles on map yet</Text>
              </View>
            </View>
          ) : null}

          {isTrackingReserved && !reservedDriver ? (
            <View style={styles.emptyOverlay} pointerEvents="none">
              <View style={styles.emptyPill}>
                <Ionicons name="locate-outline" size={14} color={Theme.colors.seatFilling} />
                <Text style={styles.emptyText}>Waiting for driver GPS…</Text>
              </View>
            </View>
          ) : null}

          {isTrackingReserved && reservedDriver ? (
            <View style={styles.trackingOverlay} pointerEvents="none">
              <View style={styles.trackingPill}>
                <View style={[styles.legendDot, { backgroundColor: Theme.colors.mateMap }]} />
                <Text style={styles.trackingPillText}>Live · tracking your ride</Text>
              </View>
            </View>
          ) : null}
        </View>

        {selectedTripId && !isTrackingReserved ? (
          <Text style={styles.mapHint}>Tap a bus icon to select · Pinch map to explore</Text>
        ) : null}
      </View>

      <Modal visible={expanded} animationType="slide" onRequestClose={() => setExpanded(false)}>
        <SafeAreaView style={styles.fullscreen} edges={['top', 'bottom']}>
          <View style={styles.fullscreenHeader}>
            <Pressable onPress={() => setExpanded(false)} style={styles.closeBtn}>
              <Ionicons name="close" size={22} color={Theme.colors.text} />
            </Pressable>
            <View style={styles.fullscreenTitleWrap}>
              <Text style={styles.fullscreenTitle}>Live map</Text>
              <Text style={styles.fullscreenSub} numberOfLines={1}>
                {fromPlace} → {toPlace}
              </Text>
            </View>
            <Pressable onPress={recenter} style={styles.iconBtn}>
              <Ionicons name="locate" size={20} color={Theme.colors.passenger} />
            </Pressable>
          </View>
          {mapReady ? (
            <MapCanvas mapRef={fullscreenMapRef} {...mapProps} style={styles.fullscreenMap} />
          ) : null}
        </SafeAreaView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginHorizontal: SCREEN_GUTTER,
    marginBottom: 12,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: Theme.colors.surface,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    ...glowShadow(Theme.colors.passenger, 0.1),
  },
  wrapTracking: {
    borderColor: Theme.colors.mate + '66',
    ...glowShadow(Theme.colors.mate, 0.15),
  },
  wrapAndroid: {
    overflow: 'visible',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Theme.colors.border,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: Theme.colors.success },
  headerTitle: { color: Theme.colors.text, fontSize: 14, fontWeight: '800' },
  liveBadge: {
    backgroundColor: Theme.colors.success + '18',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: Theme.colors.success + '33',
  },
  liveBadgeText: { color: Theme.colors.success, fontSize: 10, fontWeight: '800' },
  headerActions: { flexDirection: 'row', gap: 6 },
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: Theme.colors.surfaceUp,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Theme.colors.border,
  },
  mapBox: {
    backgroundColor: '#060606',
    position: 'relative',
  },
  mapPlaceholder: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#060606',
  },
  mapPlaceholderText: {
    color: Theme.colors.textSub,
    fontSize: 13,
    fontWeight: '600',
  },
  legend: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.65)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDivider: { width: 1, height: 12, backgroundColor: 'rgba(255,255,255,0.12)', marginHorizontal: 8 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { color: Theme.colors.textSub, fontSize: 10, fontWeight: '700' },
  emptyOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  emptyPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0,0,0,0.75)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
  },
  emptyText: { color: Theme.colors.textSub, fontSize: 12, fontWeight: '600' },
  trackingOverlay: {
    position: 'absolute',
    top: 10,
    left: 10,
    right: 10,
    alignItems: 'center',
  },
  trackingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(0,0,0,0.75)',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(33,150,243,0.35)',
  },
  trackingPillText: { color: Theme.colors.text, fontSize: 11, fontWeight: '800' },
  mapHint: {
    color: Theme.colors.textMuted,
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
  },

  placeMarker: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2.5,
    borderColor: '#FFFFFF',
  },
  placeFrom: { backgroundColor: Theme.colors.success },
  placeTo: { backgroundColor: Theme.colors.passenger },

  seatBadgeFloating: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginTop: -32,
    marginLeft: 4,
    backgroundColor: Theme.colors.success,
    borderRadius: 9,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 4,
    zIndex: 5,
  },
  seatBadgeText: { color: '#FFFFFF', fontSize: 9, fontWeight: '900' },

  calloutCard: {
    backgroundColor: '#1E1E1E',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    minWidth: 200,
    maxWidth: 260,
    gap: 4,
  },
  calloutLabel: { color: Theme.colors.textMuted, fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  calloutRoute: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  calloutMeta: { color: '#E0E0E0', fontSize: 12, fontWeight: '600' },
  calloutPlate: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  calloutEta: { color: Theme.colors.passenger, fontSize: 12, fontWeight: '700', marginTop: 2 },
  calloutSeats: { color: Theme.colors.success, fontSize: 12, fontWeight: '700', marginTop: 4 },
  yourRideBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(243,111,33,0.18)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginBottom: 2,
  },
  yourRideBadgeText: { color: Theme.colors.mate, fontSize: 10, fontWeight: '800' },

  fullscreen: { flex: 1, backgroundColor: '#121212' },
  fullscreenHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: Theme.colors.border,
    backgroundColor: Theme.colors.surface,
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Theme.colors.surfaceUp,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullscreenTitleWrap: { flex: 1 },
  fullscreenTitle: { color: Theme.colors.text, fontSize: 18, fontWeight: '900' },
  fullscreenSub: { color: Theme.colors.textSub, fontSize: 13, fontWeight: '600', marginTop: 2 },
  fullscreenMap: { flex: 1 },
});
