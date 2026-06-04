import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  DEFAULT_VEHICLE_TYPE,
  getVehicleTypeOptions,
  normalizeVehicleType,
} from '@/constants/vehicleTypes';

export default function VehicleTypePicker({
  value = DEFAULT_VEHICLE_TYPE,
  onChange,
  variant = 'profile',
}) {
  const selected = normalizeVehicleType(value);
  const options = getVehicleTypeOptions(selected);
  const isSignup = variant === 'signup';

  return (
    <View style={styles.grid}>
      {options.map((type) => {
        const isSelected = selected === type.label;
        return (
          <Pressable
            key={type.id}
            accessibilityRole="radio"
            accessibilityState={{ selected: isSelected }}
            onPress={() => onChange?.(type.label)}
            style={({ pressed }) => [
              styles.chip,
              isSignup ? styles.chipSignup : styles.chipProfile,
              isSelected && (isSignup ? styles.chipSignupSelected : styles.chipProfileSelected),
              pressed && styles.pressed,
            ]}>
            <Ionicons
              name={type.icon}
              size={16}
              color={isSelected ? '#FFFFFF' : isSignup ? '#E0E0E0' : '#E0E0E0'}
            />
            <Text
              style={[
                styles.chipText,
                isSignup ? styles.chipTextSignup : styles.chipTextProfile,
                isSelected && styles.chipTextSelected,
              ]}
              numberOfLines={2}>
              {type.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 16,
  },
  chip: {
    minWidth: '30%',
    flexGrow: 1,
    maxWidth: '48%',
    minHeight: 56,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 2,
  },
  chipSignup: {
    backgroundColor: '#1E1E1E',
    borderColor: 'transparent',
  },
  chipSignupSelected: {
    borderColor: '#F36F21',
    backgroundColor: '#3A2A1A',
  },
  chipProfile: {
    backgroundColor: '#1E1E1E',
    borderColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1,
  },
  chipProfileSelected: {
    borderColor: 'rgba(243,111,33,0.7)',
    backgroundColor: 'rgba(243,111,33,0.1)',
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  chipTextSignup: { color: '#E0E0E0' },
  chipTextProfile: { color: '#E0E0E0' },
  chipTextSelected: { color: '#FFFFFF' },
  pressed: { opacity: 0.85 },
});
