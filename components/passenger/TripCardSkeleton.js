import { StyleSheet, View } from 'react-native';

import { SkeletonBlock, SkeletonLine } from '@/components/Skeleton';
import { Theme } from '@/constants/theme';

export default function TripCardSkeleton({ count = 3 }) {
  return (
    <View style={styles.wrap}>
      {Array.from({ length: count }, (_, i) => (
        <View key={i} style={styles.card}>
          <View style={styles.row}>
            <SkeletonBlock width={44} height={44} radius={22} />
            <View style={styles.body}>
              <SkeletonLine width="55%" />
              <SkeletonLine width="38%" style={styles.gap} />
            </View>
            <SkeletonBlock width={52} height={28} radius={10} />
          </View>
          <View style={styles.footer}>
            <SkeletonLine width="30%" />
            <SkeletonLine width="22%" />
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 12, paddingHorizontal: 16, paddingTop: 8 },
  card: {
    backgroundColor: Theme.colors.surfaceUp,
    borderRadius: Theme.radius.lg,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    padding: 16,
    gap: 14,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  body: { flex: 1, gap: 8 },
  gap: { marginTop: 4 },
  footer: { flexDirection: 'row', justifyContent: 'space-between' },
});
