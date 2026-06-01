import { LinearGradient } from 'expo-linear-gradient';
import { Component } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import PremiumBackground from '@/components/PremiumBackground';
import TrotroLogo from '@/components/TrotroLogo';
import { Theme, glowShadow } from '@/constants/theme';
import { recordError } from '@/services/monitoring';

export default class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('[TrotroOS] Fatal error:', error);
    recordError(error, { componentStack: info?.componentStack, fatal: true });
  }

  render() {
    if (this.state.error) {
      return (
        <PremiumBackground>
          <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
            <View style={styles.wrap}>
              <TrotroLogo size="md" />
              <Text style={styles.badge}>SERVICE RECOVERY</Text>
              <Text style={styles.title}>Something went wrong</Text>
              <Text style={styles.message}>
                The app encountered an unexpected error. Your account data is safe. Please try again.
              </Text>
              <Pressable
                onPress={() => this.setState({ error: null })}
                style={({ pressed }) => [styles.btn, pressed && { opacity: 0.9 }]}>
                <LinearGradient
                  colors={Theme.gradients.buttonMate}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.btnGradient}>
                  <Text style={styles.btnText}>Try again</Text>
                </LinearGradient>
              </Pressable>
            </View>
          </SafeAreaView>
        </PremiumBackground>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  wrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
  },
  badge: {
    marginTop: 20,
    color: Theme.colors.textMuted,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.4,
  },
  title: {
    color: Theme.colors.text,
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: -0.5,
    marginTop: 10,
  },
  message: {
    color: Theme.colors.textSub,
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    marginTop: 10,
    maxWidth: 320,
  },
  btn: {
    marginTop: 28,
    borderRadius: Theme.radius.lg,
    overflow: 'hidden',
    ...glowShadow(Theme.colors.mate, 0.25),
  },
  btnGradient: {
    paddingHorizontal: 28,
    paddingVertical: 14,
  },
  btnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 16 },
});
