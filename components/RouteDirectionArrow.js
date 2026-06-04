import { Ionicons } from '@expo/vector-icons';
import { Platform, StyleSheet, View } from 'react-native';

import { SafeMarker } from '@/components/SafeMapView';
import { bearingDegrees, hasRouteDirection, pointAlongRoute } from '@/utils/mapDirection';

/**
 * Map marker arrow pointing from `from` toward `to` (destination).
 * Sits ~62% along the route line so it reads as "this way →".
 */
export default function RouteDirectionArrow({
  from,
  to,
  color = '#22c55e',
  fraction = 0.62,
  zIndex = 8,
}) {
  if (!hasRouteDirection(from, to)) return null;

  const coordinate = pointAlongRoute(from, to, fraction);
  const rotation = bearingDegrees(from, to);

  return (
    <SafeMarker
      coordinate={coordinate}
      anchor={{ x: 0.5, y: 0.5 }}
      tracksViewChanges={false}
      rotation={rotation}
      flat
      zIndex={zIndex}>
      <View style={[styles.arrowBubble, { backgroundColor: color, borderColor: color }]}>
        <Ionicons name="arrow-up" size={Platform.OS === 'android' ? 16 : 18} color="#FFFFFF" />
      </View>
    </SafeMarker>
  );
}

const styles = StyleSheet.create({
  arrowBubble: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 3,
    elevation: 4,
  },
});
