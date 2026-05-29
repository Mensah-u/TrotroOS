import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { useEffect, useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import ProfileHeader from '@/components/ProfileHeader';
import { APP_NAME, APP_VERSION } from '@/constants/appInfo';
import { TAB_BAR_CLEARANCE } from '@/constants/layout';
import { Theme } from '@/constants/theme';
import { supabase } from '@/services/supabase';

const SAFE_TO_CLEAR_KEYS = [
  'passengerActiveReservation',
  'mateEarningsLog',
];

function StatusDot({ ok }) {
  return <View style={[styles.dot, { backgroundColor: ok ? Theme.colors.success : Theme.colors.danger }]} />;
}

export default function AppDiagnosticsScreen({ navigation }) {
  const [supabaseOk, setSupabaseOk] = useState(null);
  const [latencyMs, setLatencyMs] = useState(null);
  const [cacheKeys, setCacheKeys] = useState(0);
  const [checking, setChecking] = useState(false);

  const runCheck = async () => {
    setChecking(true);
    setSupabaseOk(null);
    setLatencyMs(null);
    const started = Date.now();
    try {
      const { error } = await supabase.from('trips').select('id', { count: 'exact', head: true }).limit(1);
      setSupabaseOk(!error);
      setLatencyMs(Date.now() - started);
    } catch {
      setSupabaseOk(false);
    } finally {
      setChecking(false);
    }
    try {
      const keys = await AsyncStorage.getAllKeys();
      setCacheKeys(keys.length);
    } catch {
      setCacheKeys(0);
    }
  };

  useEffect(() => {
    runCheck();
  }, []);

  const clearCache = () => {
    Alert.alert(
      'Clear local cache?',
      'This removes the saved reservation cache and the trip earnings log on this device. Your account, trip history, and ratings on the server are not affected.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            await AsyncStorage.multiRemove(SAFE_TO_CLEAR_KEYS);
            Alert.alert('Done', 'Local cache cleared.');
            runCheck();
          },
        },
      ],
    );
  };

  const buildInfo = `${Platform.OS} ${Platform.Version} · Expo SDK ${Constants.expoConfig?.sdkVersion ?? '54'}`;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ProfileHeader navigation={navigation} title="App Diagnostics" />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.intro}>
          Check connectivity, app build, and storage health. Useful if rides aren't loading or live updates feel slow.
        </Text>

        <Text style={styles.sectionLabel}>CONNECTION</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <View style={styles.iconWrap}>
              <Ionicons name="cloud-outline" size={18} color={Theme.colors.textSub} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowLabel}>Supabase backend</Text>
              <Text style={styles.rowSub}>
                {checking
                  ? 'Checking…'
                  : supabaseOk == null
                    ? 'Not yet tested'
                    : supabaseOk
                      ? `Connected · ${latencyMs ?? '—'} ms`
                      : 'Unreachable — check internet'}
              </Text>
            </View>
            {supabaseOk != null ? <StatusDot ok={supabaseOk} /> : null}
          </View>
          <View style={styles.divider} />
          <Pressable onPress={runCheck} disabled={checking} style={({ pressed }) => [styles.actionRow, pressed && { opacity: 0.7 }]}>
            <Ionicons name="refresh-outline" size={16} color={Theme.colors.passenger} />
            <Text style={styles.actionText}>{checking ? 'Running test…' : 'Run connection test'}</Text>
          </Pressable>
        </View>

        <Text style={styles.sectionLabel}>BUILD & STORAGE</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <View style={styles.iconWrap}>
              <Ionicons name="information-circle-outline" size={18} color={Theme.colors.textSub} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowLabel}>{APP_NAME} version</Text>
              <Text style={styles.rowSub}>{APP_VERSION}</Text>
            </View>
          </View>
          <View style={styles.divider} />
          <View style={styles.row}>
            <View style={styles.iconWrap}>
              <Ionicons name="hardware-chip-outline" size={18} color={Theme.colors.textSub} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowLabel}>Runtime</Text>
              <Text style={styles.rowSub}>{buildInfo}</Text>
            </View>
          </View>
          <View style={styles.divider} />
          <View style={styles.row}>
            <View style={styles.iconWrap}>
              <Ionicons name="archive-outline" size={18} color={Theme.colors.textSub} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowLabel}>Local cache keys</Text>
              <Text style={styles.rowSub}>{cacheKeys} stored on this device</Text>
            </View>
          </View>
          <View style={styles.divider} />
          <Pressable onPress={clearCache} style={({ pressed }) => [styles.actionRow, pressed && { opacity: 0.7 }]}>
            <Ionicons name="trash-outline" size={16} color={Theme.colors.danger} />
            <Text style={[styles.actionText, { color: Theme.colors.danger }]}>Clear local cache</Text>
          </Pressable>
        </View>

        <View style={styles.tipCard}>
          <Ionicons name="bulb-outline" size={16} color={Theme.colors.gold} />
          <Text style={styles.tipText}>
            Tip: If queue or live updates are slow, run the connection test, then close and reopen the app.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Theme.colors.bgElevated },
  content: { padding: 20, paddingBottom: TAB_BAR_CLEARANCE },
  intro: { color: Theme.colors.textSub, fontSize: 14, lineHeight: 20, marginBottom: 16 },
  sectionLabel: { color: Theme.colors.textMuted, fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 10 },
  card: {
    backgroundColor: Theme.colors.surface,
    borderRadius: Theme.radius.lg,
    borderWidth: 1, borderColor: Theme.colors.border,
    overflow: 'hidden', marginBottom: 16,
  },
  row: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
  iconWrap: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: Theme.colors.surfaceUp,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Theme.colors.border,
  },
  rowLabel: { color: Theme.colors.text, fontSize: 14, fontWeight: '600' },
  rowSub: { color: Theme.colors.textMuted, fontSize: 12, marginTop: 2 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  divider: { height: 1, backgroundColor: Theme.colors.border, marginLeft: 60 },
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 14 },
  actionText: { color: Theme.colors.passenger, fontSize: 14, fontWeight: '700' },
  tipCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    backgroundColor: 'rgba(251,191,36,0.08)',
    borderRadius: Theme.radius.lg, padding: 14,
    borderWidth: 1, borderColor: 'rgba(251,191,36,0.25)',
  },
  tipText: { flex: 1, color: Theme.colors.textSub, fontSize: 13, lineHeight: 19 },
});
