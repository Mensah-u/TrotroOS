import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Theme, glowShadow } from '@/constants/theme';

/**
 * Shared empty-state pattern — icon ring, title, subtitle, optional CTA.
 */
export default function EmptyState({
  icon = 'bus-outline',
  iconColor = Theme.colors.textMuted,
  title,
  subtitle,
  actionLabel,
  onAction,
  compact = false,
}) {
  return (
    <View style={[styles.wrap, compact && styles.wrapCompact]}>
      <View style={[styles.iconRing, { borderColor: iconColor + '44' }]}>
        <Ionicons name={icon} size={compact ? 28 : 36} color={iconColor} />
      </View>
      {title ? <Text style={styles.title}>{title}</Text> : null}
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      {actionLabel && onAction ? (
        <Pressable
          onPress={onAction}
          style={({ pressed }) => [styles.action, pressed && { opacity: 0.88 }]}>
          <Text style={styles.actionText}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    paddingVertical: 36,
    paddingHorizontal: 24,
  },
  wrapCompact: {
    paddingVertical: 24,
  },
  iconRing: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 1,
    backgroundColor: Theme.colors.glass,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    color: Theme.colors.text,
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
    textAlign: 'center',
  },
  subtitle: {
    color: Theme.colors.textSub,
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    marginTop: 8,
    maxWidth: 320,
  },
  action: {
    marginTop: 20,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: Theme.radius.lg,
    backgroundColor: Theme.colors.passengerSoft,
    borderWidth: 1,
    borderColor: Theme.colors.passenger + '55',
    ...glowShadow(Theme.colors.passenger, 0.08),
  },
  actionText: {
    color: Theme.colors.passengerMap,
    fontSize: 14,
    fontWeight: '800',
  },
});
