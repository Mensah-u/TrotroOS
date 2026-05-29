import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { Theme } from '@/constants/theme';

/**
 * Full-width primary CTA — consistent height, alignment, and tap target app-wide.
 */
export default function PrimaryButton({
  label,
  onPress,
  disabled = false,
  loading = false,
  icon,
  iconPosition = 'left',
  accent = Theme.colors.mate,
  style,
  textStyle,
}) {
  const inactive = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [
        styles.btn,
        { backgroundColor: inactive ? '#A8A8A8' : accent, shadowColor: accent },
        inactive && styles.btnDisabled,
        pressed && !inactive && styles.btnPressed,
        style,
      ]}>
      {loading ? (
        <ActivityIndicator color="#FFFFFF" />
      ) : (
        <View style={styles.row}>
          {icon && iconPosition === 'left' ? (
            <Ionicons name={icon} size={20} color="#FFFFFF" />
          ) : null}
          <Text style={[styles.label, textStyle]}>{label}</Text>
          {icon && iconPosition === 'right' ? (
            <Ionicons name={icon} size={20} color="#FFFFFF" />
          ) : null}
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'stretch',
    minHeight: 56,
    borderRadius: 14,
    paddingHorizontal: 20,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 4,
  },
  btnDisabled: { shadowOpacity: 0 },
  btnPressed: { opacity: 0.88 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  label: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
  },
});
