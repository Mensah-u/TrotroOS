import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Theme, glowShadow } from '@/constants/theme';
import { hapticMedium } from '@/utils/haptics';

export default function PremiumButton({
  label,
  onPress,
  icon,
  variant = 'mate',
  disabled = false,
  loading = false,
  style,
}) {
  const colors =
    variant === 'passenger'
      ? Theme.gradients.buttonPassenger
      : Theme.gradients.buttonMate;
  const glow = variant === 'passenger' ? Theme.colors.passenger : Theme.colors.mate;

  return (
    <Pressable
      disabled={disabled || loading}
      onPress={() => {
        hapticMedium();
        onPress?.();
      }}
      style={({ pressed }) => [
        styles.wrap,
        !disabled && glowShadow(glow, 0.35),
        pressed && !disabled && { opacity: 0.92, transform: [{ scale: 0.985 }] },
        disabled && styles.disabled,
        style,
      ]}>
      <LinearGradient
        colors={disabled ? ['#3F3F46', '#27272A'] : colors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradient}>
        {icon ? <View style={styles.icon}>{icon}</View> : null}
        <Text style={styles.label}>{loading ? 'Please wait…' : label}</Text>
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { borderRadius: Theme.radius.lg, overflow: 'hidden' },
  gradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    minHeight: 56,
    paddingHorizontal: 24,
  },
  icon: {},
  label: { color: '#FFFFFF', fontSize: 16, fontWeight: '800', letterSpacing: 0.2 },
  disabled: { shadowOpacity: 0, elevation: 0 },
});
