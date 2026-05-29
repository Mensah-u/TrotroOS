import { Component } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Theme } from '@/constants/theme';
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
        <View style={styles.wrap}>
          <Text style={styles.title}>TrotroOS hit a snag</Text>
          <Text style={styles.message}>
            {this.state.error?.message ?? 'Something went wrong on startup.'}
          </Text>
          <Pressable
            onPress={() => this.setState({ error: null })}
            style={styles.btn}>
            <Text style={styles.btnText}>Try again</Text>
          </Pressable>
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: Theme.colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  title: { color: Theme.colors.text, fontSize: 20, fontWeight: '800', marginBottom: 8 },
  message: { color: Theme.colors.textSub, fontSize: 14, textAlign: 'center', lineHeight: 20 },
  btn: {
    marginTop: 24,
    backgroundColor: Theme.colors.mate,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  btnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 15 },
});
