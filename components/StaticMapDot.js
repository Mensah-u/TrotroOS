import { StyleSheet, View } from 'react-native';

/** Minimal marker child for Android — no animation, no nested views. */
export default function StaticMapDot({ color, size = 22 }) {
  return (
    <View
      style={[
        styles.dot,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
        },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  dot: {
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
});
