import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import LivePulse from '@/components/LivePulse';
import { SkeletonLine } from '@/components/Skeleton';
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
          <LivePulse color={Theme.colors.passengerMap} size={8} />
          <Text style={styles.loadingText}>{PASSENGER.loadingLive}</Text>
        </View>
        <View style={styles.skeletonRow}>
          <SkeletonLine width="100%" />
          <SkeletonLine width="68%" style={styles.skeletonGap} />
        </View>
      </View>
    );
  }

  if (phase === 'results') {
    return (
      <View style={[styles.wrap, styles.wrapCompact]}>
        <View style={styles.resultsRow}>
          <Ionicons name="radio" size={15} color={Theme.colors.passengerMap} />
          <Text style={styles.resultsText}>{PASSENGER.routeScanning(liveCount)}</Text>
        </View>
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
    borderRadius: Theme.radius.lg,
    backgroundColor: Theme.colors.surfaceUp,
    borderWidth: 1,
    borderColor: Theme.colors.passenger + '33',
  },
  wrapCompact: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 8,
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
  skeletonRow: { marginTop: 12, gap: 8 },
  skeletonGap: { marginTop: 0 },
  resultsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  resultsText: {
    flex: 1,
    color: Theme.colors.text,
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
  },
});
