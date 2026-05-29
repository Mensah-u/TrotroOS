import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';

/**
 * Premium pulsing marker for a Google Map.
 *
 * Layered to look expensive:
 *   • Two staggered radar ring pulses
 *   • A breathing soft-glow halo
 *   • A glossy solid dot with crisp white border + colored drop shadow
 *   • Optional inner Ionicon glyph
 *   • Optional sleek label badge under the dot
 *
 * All animations run on the native driver so the marker stays
 * smooth on Android even with tracksViewChanges={false}.
 */
export default function PulsingMapMarker({
  color = '#2563EB',
  size = 38,
  icon,
  iconColor = '#FFFFFF',
  label,
  selected = false,
  ringOpacity = 0.55,
  ringScaleTo = 2.7,
}) {
  const ringA = useRef(new Animated.Value(0)).current;
  const ringB = useRef(new Animated.Value(0)).current;
  const halo  = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const radar = (val, delay) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(val, {
            toValue: 1,
            duration: 1900,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(val, {
            toValue: 0,
            duration: 0,
            useNativeDriver: true,
          }),
        ]),
      );

    const haloLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(halo, {
          toValue: 1,
          duration: 1300,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(halo, {
          toValue: 0,
          duration: 1300,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );

    const a = radar(ringA, 0);
    const b = radar(ringB, 950);
    a.start();
    b.start();
    haloLoop.start();
    return () => {
      a.stop();
      b.stop();
      haloLoop.stop();
    };
  }, [ringA, ringB, halo]);

  const ringStyle = (val) => ({
    opacity: val.interpolate({ inputRange: [0, 1], outputRange: [ringOpacity, 0] }),
    transform: [
      { scale: val.interpolate({ inputRange: [0, 1], outputRange: [1, ringScaleTo] }) },
    ],
  });

  const haloStyle = {
    opacity: halo.interpolate({ inputRange: [0, 1], outputRange: [0.28, 0.62] }),
    transform: [
      { scale: halo.interpolate({ inputRange: [0, 1], outputRange: [1, 1.22] }) },
    ],
  };

  const dotSize  = selected ? size + 4 : size;
  const ringSize = size + 6;
  const haloSize = size + 14;
  const wrapSize = Math.max(size * 3, 96);

  return (
    <View
      style={{
        width: wrapSize,
        height: wrapSize + (label ? 22 : 0),
        alignItems: 'center',
        justifyContent: 'center',
      }}
      pointerEvents="none">
      {/* Radar pulses (offset) */}
      <Animated.View
        style={[
          styles.ringBase,
          {
            width: ringSize,
            height: ringSize,
            borderRadius: ringSize / 2,
            borderColor: color,
            backgroundColor: color + '22',
          },
          ringStyle(ringA),
        ]}
      />
      <Animated.View
        style={[
          styles.ringBase,
          {
            width: ringSize,
            height: ringSize,
            borderRadius: ringSize / 2,
            borderColor: color,
            backgroundColor: color + '22',
          },
          ringStyle(ringB),
        ]}
      />

      {/* Breathing halo */}
      <Animated.View
        style={[
          styles.haloBase,
          {
            width: haloSize,
            height: haloSize,
            borderRadius: haloSize / 2,
            backgroundColor: color + '55',
          },
          haloStyle,
        ]}
      />

      {/* Solid premium dot */}
      <View
        style={[
          styles.dotBase,
          {
            width: dotSize,
            height: dotSize,
            borderRadius: dotSize / 2,
            backgroundColor: color,
            shadowColor: color,
          },
        ]}>
        {/* Glossy inner shine */}
        <View
          style={[
            styles.shine,
            {
              width: dotSize * 0.55,
              height: dotSize * 0.32,
              borderRadius: dotSize * 0.5,
              top: dotSize * 0.12,
            },
          ]}
        />
        {icon ? (
          <Ionicons name={icon} size={dotSize * 0.48} color={iconColor} />
        ) : null}
      </View>

      {label ? (
        <View style={styles.labelWrap}>
          <Text style={styles.labelText} numberOfLines={1}>
            {label}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  ringBase: {
    position: 'absolute',
    borderWidth: 2,
  },
  haloBase: {
    position: 'absolute',
  },
  dotBase: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2.5,
    borderColor: '#FFFFFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.55,
    shadowRadius: 10,
    elevation: 10,
  },
  shine: {
    position: 'absolute',
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  labelWrap: {
    marginTop: 6,
    backgroundColor: 'rgba(15,23,42,0.92)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    maxWidth: 140,
  },
  labelText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
});
