import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Theme } from '@/constants/theme';
import { hapticSelect } from '@/utils/haptics';

export default function GlassCard({
  title,
  subtitle,
  icon,
  iconColor = Theme.colors.mate,
  gradientColors = Theme.gradients.mateCard,
  features = [],
  onPress,
  badge,
}) {
  return (
    <Pressable
      onPress={() => {
        hapticSelect();
        onPress?.();
      }}
      style={({ pressed }) => [styles.wrap, pressed && styles.pressed]}>
      <LinearGradient
        colors={gradientColors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradient}>
        <View style={styles.topRow}>
          <View style={[styles.iconBox, { backgroundColor: iconColor + '22', borderColor: iconColor + '44' }]}>
            <Ionicons name={icon} size={28} color={iconColor} />
          </View>
          {badge ? (
            <View style={[styles.badge, { backgroundColor: iconColor + '22' }]}>
              <Text style={[styles.badgeText, { color: iconColor }]}>{badge}</Text>
            </View>
          ) : null}
        </View>

        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>

        {features.length > 0 ? (
          <View style={styles.features}>
            {features.map((f) => (
              <View key={f} style={styles.featurePill}>
                <Ionicons name="checkmark-circle" size={12} color={iconColor} />
                <Text style={styles.featureText}>{f}</Text>
              </View>
            ))}
          </View>
        ) : null}

        <View style={styles.ctaRow}>
          <Text style={[styles.cta, { color: iconColor }]}>Get started</Text>
          <Ionicons name="arrow-forward" size={18} color={iconColor} />
        </View>
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: Theme.radius.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Theme.colors.borderStrong,
  },
  pressed: { opacity: 0.94, transform: [{ scale: 0.99 }] },
  gradient: { padding: 22 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  iconBox: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  badge: { borderRadius: Theme.radius.pill, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { fontSize: 11, fontWeight: '800', letterSpacing: 0.3 },
  title: { color: Theme.colors.text, fontSize: 22, fontWeight: '900', letterSpacing: -0.4 },
  subtitle: { color: Theme.colors.textSub, fontSize: 14, lineHeight: 21, marginTop: 6 },
  features: { gap: 8, marginTop: 16 },
  featurePill: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  featureText: { color: Theme.colors.textSub, fontSize: 13, fontWeight: '600' },
  ctaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 18 },
  cta: { fontSize: 15, fontWeight: '800' },
});
