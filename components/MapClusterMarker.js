import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';

/**
 * Premium cluster bubble for a Google Map. Grows by count, breathes gently,
 * and matches the visual language of `PulsingMapMarker` so individual markers
 * and clusters feel like one coherent system.
 */
export default function MapClusterMarker({
  count,
  color = '#F97316',
  textColor = '#FFFFFF',
}) {
  const breathe = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(breathe, {
          toValue: 1,
          duration: 1400,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(breathe, {
          toValue: 0,
          duration: 1400,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [breathe]);

  // Size scales gently with count: 36 for tiny clusters, ~58 for big ones.
  const size = Math.min(58, 32 + Math.round(Math.log10(Math.max(1, count)) * 18));
  const haloSize = size + 14;

  const haloStyle = {
    opacity: breathe.interpolate({ inputRange: [0, 1], outputRange: [0.3, 0.6] }),
    transform: [
      { scale: breathe.interpolate({ inputRange: [0, 1], outputRange: [1, 1.18] }) },
    ],
  };

  return (
    <View style={styles.wrap} pointerEvents="none">
      <Animated.View
        style={[
          styles.halo,
          {
            width: haloSize,
            height: haloSize,
            borderRadius: haloSize / 2,
            backgroundColor: color + '55',
          },
          haloStyle,
        ]}
      />
      <View
        style={[
          styles.bubble,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: color,
            shadowColor: color,
          },
        ]}>
        <Text style={[styles.text, { color: textColor, fontSize: size * 0.36 }]}>
          {count}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: 80,
    height: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  halo: {
    position: 'absolute',
  },
  bubble: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2.5,
    borderColor: '#FFFFFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.55,
    shadowRadius: 10,
    elevation: 10,
  },
  text: {
    fontWeight: '900',
    letterSpacing: -0.2,
  },
});
