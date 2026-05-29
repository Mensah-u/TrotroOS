import { Ionicons } from '@expo/vector-icons';
import { forwardRef, useImperativeHandle, useRef } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';

import { GOOGLE_MAPS_ANDROID_KEY } from '@/constants/config';
import { Theme } from '@/constants/theme';

const MAP_REF_STUB = {
  animateToRegion: () => {},
  fitToCoordinates: () => {},
};

/**
 * Android release APKs crash when MapView loads without a Google Maps API key.
 */
export function canUseNativeMap() {
  if (Platform.OS !== 'android') return true;
  return Boolean(GOOGLE_MAPS_ANDROID_KEY?.trim());
}

const SafeMapView = forwardRef(function SafeMapView(
  { style, children, fallbackMessage, ...props },
  ref,
) {
  const mapRef = useRef(null);

  useImperativeHandle(ref, () => {
    if (!canUseNativeMap()) return MAP_REF_STUB;
    return mapRef.current ?? MAP_REF_STUB;
  }, []);

  if (canUseNativeMap()) {
    const Maps = require('react-native-maps');
    const MapView = Maps.default;
    const provider = Platform.OS === 'android' ? Maps.PROVIDER_GOOGLE : undefined;
    return (
      <View style={style} collapsable={false}>
        <MapView
          ref={mapRef}
          provider={provider}
          style={StyleSheet.absoluteFill}
          moveOnMarkerPress={false}
          {...props}>
          {children}
        </MapView>
      </View>
    );
  }

  return (
    <View style={[styles.fallback, style]}>
      <Ionicons name="map-outline" size={32} color={Theme.colors.textMuted} />
      <Text style={styles.fallbackTitle}>Map view</Text>
      <Text style={styles.fallbackText}>
        {fallbackMessage ??
          'Rides and booking work below. Add a Google Maps API key for live maps in release builds.'}
      </Text>
    </View>
  );
});

export default SafeMapView;

export function SafeMarker(props) {
  if (!canUseNativeMap()) return null;
  const { Marker } = require('react-native-maps');
  return <Marker {...props} />;
}

export function SafePolyline(props) {
  if (!canUseNativeMap()) return null;
  const { Polyline } = require('react-native-maps');
  return <Polyline {...props} />;
}

export function SafeCallout(props) {
  if (!canUseNativeMap()) return props.children ?? null;
  const { Callout } = require('react-native-maps');
  return <Callout {...props} />;
}

const styles = StyleSheet.create({
  fallback: {
    backgroundColor: '#0a0a0a',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  fallbackTitle: { color: Theme.colors.text, fontSize: 16, fontWeight: '800', marginTop: 10 },
  fallbackText: {
    color: Theme.colors.textSub,
    fontSize: 12,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
  },
});
