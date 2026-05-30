import { Ionicons } from '@expo/vector-icons';
import { forwardRef, useImperativeHandle } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Theme } from '@/constants/theme';

const MAP_REF_STUB = {
  animateToRegion: () => {},
  fitToCoordinates: () => {},
};

/** Web uses list + route cards; native MapView is not available in the browser. */
export function canUseNativeMap() {
  return false;
}

const SafeMapView = forwardRef(function SafeMapView(
  { style, fallbackMessage, ..._props },
  ref,
) {
  useImperativeHandle(ref, () => MAP_REF_STUB, []);

  return (
    <View style={[styles.fallback, style]}>
      <Ionicons name="globe-outline" size={32} color={Theme.colors.passenger} />
      <Text style={styles.fallbackTitle}>Web map preview</Text>
      <Text style={styles.fallbackText}>
        {fallbackMessage ??
          'Live vehicle map runs on the Android app. On web, pick a ride from the list below — reserve and track still work via Supabase.'}
      </Text>
    </View>
  );
});

export default SafeMapView;

export function SafeMarker() {
  return null;
}

export function SafePolyline() {
  return null;
}

export function SafeCallout({ children }) {
  return children ?? null;
}

const styles = StyleSheet.create({
  fallback: {
    backgroundColor: '#0a0a0a',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    minHeight: 180,
  },
  fallbackTitle: { color: Theme.colors.text, fontSize: 16, fontWeight: '800', marginTop: 10 },
  fallbackText: {
    color: Theme.colors.textSub,
    fontSize: 12,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
    maxWidth: 320,
  },
});
