import { useEffect, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';

import LoginForm from '@/screens/mate/LoginForm';
import SignUpForm from '@/screens/mate/SignUpForm';
import { isMateBackendReady } from '@/services/supabase';

export default function MateAuthScreen({ onSuccess, onBack }) {
  const [mode, setMode] = useState('login');
  const [backendReady, setBackendReady] = useState(true);

  useEffect(() => {
    isMateBackendReady().then(setBackendReady);
  }, []);

  const setupBanner = !backendReady ? (
    <View style={styles.setupBanner}>
      <Text style={styles.setupTitle}>Service configuration required</Text>
      <Text style={styles.setupText}>
        Mate sign-in is unavailable until the backend is configured. Open Profile → App Diagnostics to check connectivity, or contact support.
      </Text>
    </View>
  ) : null;

  if (mode === 'signup') {
    return (
      <>
        {setupBanner}
        <SignUpForm
          onSuccess={onSuccess}
          onSwitchToLogin={() => setMode('login')}
          onBack={onBack}
        />
      </>
    );
  }

  return (
    <>
      {setupBanner}
      <LoginForm
        onSuccess={onSuccess}
        onSwitchToSignUp={() => setMode('signup')}
        onBack={onBack}
      />
    </>
  );
}

const styles = StyleSheet.create({
  setupBanner: {
    backgroundColor: 'rgba(234,179,8,0.12)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(234,179,8,0.35)',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  setupTitle: { color: '#FDE68A', fontSize: 14, fontWeight: '800', marginBottom: 4 },
  setupText: { color: '#FCD34D', fontSize: 12, lineHeight: 18 },
  setupCode: { fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', fontWeight: '700' },
});
