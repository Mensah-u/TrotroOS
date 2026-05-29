import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { Theme } from '@/constants/theme';

export function FormInput({ label, style, onFocus, onBlur, accentColor = Theme.colors.mate, ...props }) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={[styles.field, style]}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TextInput
        {...props}
        placeholderTextColor={Theme.colors.textMuted}
        onFocus={(e) => { setFocused(true); onFocus?.(e); }}
        onBlur={(e) => { setFocused(false); onBlur?.(e); }}
        style={[
          styles.input,
          focused && {
            borderColor: accentColor + 'AA',
            backgroundColor: accentColor + '0A',
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  field: { marginBottom: 16 },
  label: {
    ...Theme.typography.label,
    color: Theme.colors.textMuted,
    marginBottom: 7,
  },
  input: {
    backgroundColor: Theme.colors.surface,
    color: Theme.colors.text,
    fontSize: 16,
    minHeight: 54,
    borderRadius: Theme.radius.md,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: Theme.colors.border,
  },
});
