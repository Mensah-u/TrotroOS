import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { SCREEN_GUTTER } from '@/constants/layout';
import { Theme } from '@/constants/theme';

export default function BrandHeader({
  title = 'TrotroOS',
  subtitle,
  variant = 'passenger',
  right,
  liveCount,
}) {
  const accent = variant === 'mate' ? Theme.colors.mate : Theme.colors.passenger;
  const gradient = variant === 'mate' ? Theme.gradients.mateHero : Theme.gradients.passengerHero;

  return (
    <View style={styles.wrap}>
      <LinearGradient colors={gradient} style={styles.glow} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />
      <View style={styles.row}>
        <View style={styles.left}>
          <View style={styles.titleRow}>
            <View style={[styles.dot, { backgroundColor: accent }]} />
            <View style={styles.titleBlock}>
              <Text style={styles.title}>{title}</Text>
              {subtitle ? (
                <Text style={styles.subtitle} numberOfLines={2}>
                  {subtitle}
                </Text>
              ) : null}
            </View>
          </View>
        </View>
        {(liveCount != null && liveCount > 0) || right ? (
          <View style={styles.right}>
            {liveCount != null && liveCount > 0 ? (
              <View style={[styles.livePill, { borderColor: Theme.colors.success + '44' }]}>
                <View style={styles.liveDot} />
                <Text style={styles.liveText}>{liveCount} live</Text>
              </View>
            ) : null}
            {right}
          </View>
        ) : null}
      </View>
    </View>
  );
}

export function HeaderIconButton({ icon, active, onPress, accent = Theme.colors.passenger }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.iconBtn,
        active && { backgroundColor: accent + '22', borderColor: accent + '55' },
        pressed && { opacity: 0.85 },
      ]}>
      <Ionicons name={icon} size={18} color={active ? accent : Theme.colors.textSub} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: SCREEN_GUTTER,
    paddingTop: 8,
    paddingBottom: 12,
    overflow: 'hidden',
  },
  glow: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.9,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  left: { flex: 1, minWidth: 0 },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  titleBlock: { flex: 1, minWidth: 0 },
  dot: { width: 8, height: 8, borderRadius: 4, marginTop: 10 },
  title: { color: Theme.colors.text, fontSize: 24, fontWeight: '900', letterSpacing: -0.6 },
  subtitle: {
    color: Theme.colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
    marginTop: 4,
    lineHeight: 18,
  },
  right: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: 4 },
  livePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Theme.colors.successSoft,
    borderRadius: Theme.radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
  },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Theme.colors.success },
  liveText: { color: Theme.colors.success, fontSize: 12, fontWeight: '800' },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Theme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Theme.colors.border,
  },
});
