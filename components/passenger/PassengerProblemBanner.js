import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { PASSENGER } from '@/constants/problemSolution';
import { SCREEN_GUTTER } from '@/constants/layout';
import { Theme } from '@/constants/theme';

/**
 * Problem-first hero: user knows in ~5s what the app does and what to do next.
 */
export default function PassengerProblemBanner({ phase, liveCount = 0 }) {
  if (phase === 'hidden' || phase === 'idle') return null;

  if (phase === 'loading') {
    return (
      <View style={[styles.wrap, styles.wrapCompact]}>
        <View style={styles.loadingRow}>
          <Ionicons name="radio-outline" size={16} color={Theme.colors.passenger} />
          <Text style={styles.loadingText}>{PASSENGER.loadingLive}</Text>
        </View>
      </View>
    );
  }

  if (phase === 'results') {
    return (
      <View style={[styles.wrap, styles.wrapCompact]}>
        <Text style={styles.resultsText}>{PASSENGER.routeScanning(liveCount)}</Text>
      </View>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  wrap: {
    marginHorizontal: SCREEN_GUTTER,
    marginBottom: 12,
    padding: 16,
    borderRadius: 16,
    backgroundColor: Theme.colors.surface,
    borderWidth: 1,
    borderColor: Theme.colors.passenger + '33',
  },
  wrapCompact: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 8,
  },
  heroTitle: {
    color: Theme.colors.text,
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  loadingText: {
    flex: 1,
    color: Theme.colors.textSub,
    fontSize: 14,
    fontWeight: '700',
  },
  resultsText: {
    color: Theme.colors.text,
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
  },
});
