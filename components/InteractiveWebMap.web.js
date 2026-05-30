import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { StyleSheet, View } from 'react-native';

import { GOOGLE_MAPS_WEB_KEY } from '@/constants/config';
import { darkMapStyle } from '@/constants/theme';
import { loadGoogleMaps } from '@/services/loadGoogleMaps.web';

function deltaToZoom(latitudeDelta = 0.05) {
  return Math.round(Math.log2(360 / Math.max(latitudeDelta, 0.001)));
}

function regionToCenter(region) {
  if (!region?.latitude) return { lat: 6.673, lng: -1.565 };
  return { lat: region.latitude, lng: region.longitude };
}

const MAP_DOM_ID = 'trotro-interactive-map';

const InteractiveWebMap = forwardRef(function InteractiveWebMap(
  {
    style,
    initialRegion,
    markers = [],
    polyline = [],
    mapStyle = darkMapStyle,
  },
  ref,
) {
  const mapRef = useRef(null);
  const markerRefs = useRef([]);
  const polylineRef = useRef(null);

  useImperativeHandle(ref, () => ({
    animateToRegion(region, _duration = 500) {
      const map = mapRef.current;
      if (!map || !region?.latitude) return;
      map.panTo({ lat: region.latitude, lng: region.longitude });
      if (region.latitudeDelta) {
        map.setZoom(deltaToZoom(region.latitudeDelta));
      }
    },
    fitToCoordinates(points, options = {}) {
      const map = mapRef.current;
      const maps = window.google?.maps;
      if (!map || !maps || !points?.length) return;
      const bounds = new maps.LatLngBounds();
      points.forEach((p) => {
        if (p?.latitude != null) bounds.extend({ lat: p.latitude, lng: p.longitude });
      });
      const pad = options.edgePadding ?? { top: 48, right: 48, bottom: 48, left: 48 };
      map.fitBounds(bounds, pad);
    },
  }), []);

  useEffect(() => {
    let cancelled = false;

    loadGoogleMaps(GOOGLE_MAPS_WEB_KEY)
      .then((maps) => {
        if (cancelled) return;
        const node = document.getElementById(MAP_DOM_ID);
        if (!node) return;
        const center = regionToCenter(initialRegion);
        const map = new maps.Map(node, {
          center,
          zoom: deltaToZoom(initialRegion?.latitudeDelta),
          disableDefaultUI: true,
          zoomControl: true,
          gestureHandling: 'greedy',
          styles: mapStyle,
          backgroundColor: '#121212',
        });
        mapRef.current = map;
      })
      .catch((err) => {
        console.warn('[TrotroOS] Web map init failed:', err.message);
      });

    return () => {
      cancelled = true;
      mapRef.current = null;
    };
  }, [initialRegion, mapStyle]);

  useEffect(() => {
    const map = mapRef.current;
    const maps = window.google?.maps;
    if (!map || !maps) return;

    markerRefs.current.forEach((m) => m.setMap(null));
    markerRefs.current = [];

    markers.forEach((m) => {
      if (m.lat == null || m.lng == null) return;
      const marker = new maps.Marker({
        map,
        position: { lat: m.lat, lng: m.lng },
        title: m.title ?? m.label ?? '',
        label: m.label ? { text: m.label, color: '#ffffff', fontWeight: '700', fontSize: '10px' } : undefined,
        icon: m.color
          ? {
              path: maps.SymbolPath.CIRCLE,
              scale: m.scale ?? 10,
              fillColor: m.color,
              fillOpacity: 1,
              strokeColor: '#ffffff',
              strokeWeight: 2,
            }
          : undefined,
        zIndex: m.zIndex ?? 1,
      });
      if (m.onPress) marker.addListener('click', m.onPress);
      markerRefs.current.push(marker);
    });
  }, [markers]);

  useEffect(() => {
    const map = mapRef.current;
    const maps = window.google?.maps;
    if (!map || !maps) return;

    if (polylineRef.current) {
      polylineRef.current.setMap(null);
      polylineRef.current = null;
    }
    if (polyline.length >= 2) {
      polylineRef.current = new maps.Polyline({
        map,
        path: polyline.map((p) => ({ lat: p.latitude, lng: p.longitude })),
        strokeColor: '#66BB6A',
        strokeOpacity: 0.75,
        strokeWeight: 3,
        geodesic: true,
      });
    }
  }, [polyline]);

  return (
    <View style={[styles.wrap, style]} collapsable={false}>
      <View nativeID={MAP_DOM_ID} style={styles.mapNode} />
    </View>
  );
});

export default InteractiveWebMap;

const styles = StyleSheet.create({
  wrap: { overflow: 'hidden', backgroundColor: '#0a0a0a' },
  mapNode: { width: '100%', height: '100%', minHeight: 180 },
});
