import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useState } from 'react';
import {
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { TAB_BAR_CLEARANCE } from '@/constants/layout';
import { formatRoute, routes } from '@/constants/routes';
import { getMateEarningsLog, getMateEarningsTotal } from '@/services/mateEarnings';
import { C } from '@/constants/theme';

const SUPPORT_PHONE = '+233256238825';

function formatGhs(amount) {
  return `GHS ${Number(amount).toFixed(2)}`;
}

function formatDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function EarnScreen({ navigation }) {
  const [total, setTotal] = useState(0);
  const [log, setLog] = useState([]);

  const refresh = useCallback(async () => {
    const [t, l] = await Promise.all([getMateEarningsTotal(), getMateEarningsLog()]);
    setTotal(t);
    setLog(l);
  }, []);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color={C.TEXT} />
        </Pressable>
        <Text style={styles.headerTitle}>Earn with TrotroOS</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.heroCard}>
          <View style={styles.heroIcon}>
            <Ionicons name="wallet" size={28} color={C.ACCENT} />
          </View>
          <Text style={styles.heroLabel}>Total earnings</Text>
          <Text style={styles.heroAmount}>{formatGhs(total)}</Text>
          <Text style={styles.heroSub}>Track fares from every passenger you onboard.</Text>
        </View>

        <Text style={styles.sectionLabel}>HOW IT WORKS</Text>
        <View style={styles.stepsCard}>
          {[
            { icon: 'play-circle-outline', title: 'Start a trip', sub: 'Pick your route and depart on the Mate dashboard.' },
            { icon: 'person-add-outline', title: 'Onboard passengers', sub: 'Tap +1 ONBOARDED each time someone boards.' },
            { icon: 'cash-outline', title: 'Earn per passenger', sub: 'Your trip earnings update instantly on the dashboard.' },
          ].map((step, i) => (
            <View key={step.title} style={[styles.stepRow, i < 2 && styles.stepRowBorder]}>
              <View style={styles.stepIcon}>
                <Ionicons name={step.icon} size={20} color={C.ACCENT} />
              </View>
              <View style={styles.stepText}>
                <Text style={styles.stepTitle}>{step.title}</Text>
                <Text style={styles.stepSub}>{step.sub}</Text>
              </View>
            </View>
          ))}
        </View>

        <Text style={styles.sectionLabel}>FARE TABLE (Kumasi)</Text>
        <View style={styles.fareCard}>
          {routes.map((route, i) => (
            <View key={route.id} style={[styles.fareRow, i < routes.length - 1 && styles.fareRowBorder]}>
              <Text style={styles.fareRoute} numberOfLines={1}>{formatRoute(route)}</Text>
              <Text style={styles.fareAmount}>GHS {route.fareGhs}</Text>
            </View>
          ))}
        </View>

        {log.length > 0 ? (
          <>
            <Text style={styles.sectionLabel}>RECENT TRIPS</Text>
            <View style={styles.logCard}>
              {log.slice(0, 10).map((entry, i) => (
                <View key={`${entry.at}-${i}`} style={[styles.logRow, i < Math.min(log.length, 10) - 1 && styles.logRowBorder]}>
                  <View style={styles.logLeft}>
                    <Text style={styles.logRoute} numberOfLines={1}>{entry.route}</Text>
                    <Text style={styles.logMeta}>{entry.passengers} passenger{entry.passengers === 1 ? '' : 's'} · {formatDate(entry.at)}</Text>
                  </View>
                  <Text style={styles.logAmount}>+{formatGhs(entry.amountGhs)}</Text>
                </View>
              ))}
            </View>
          </>
        ) : null}

        <View style={styles.payoutCard}>
          <Ionicons name="phone-portrait-outline" size={22} color={C.SUCCESS} />
          <View style={styles.payoutText}>
            <Text style={styles.payoutTitle}>Payouts via Mobile Money</Text>
            <Text style={styles.payoutSub}>Contact TrotroOS support to set up weekly payouts to your MoMo number.</Text>
          </View>
        </View>

        <Pressable
          onPress={() => Linking.openURL(`tel:${SUPPORT_PHONE}`)}
          style={({ pressed }) => [styles.contactBtn, pressed && { opacity: 0.85 }]}>
          <Ionicons name="call-outline" size={18} color="#FFFFFF" />
          <Text style={styles.contactBtnText}>Contact Support — {SUPPORT_PHONE}</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: C.BG },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: C.BORDER,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { color: C.TEXT, fontSize: 17, fontWeight: '800' },
  content: { padding: 20, paddingBottom: TAB_BAR_CLEARANCE, gap: 0 },

  heroCard: {
    backgroundColor: C.SURFACE,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: C.ACCENT + '40',
    marginBottom: 24,
  },
  heroIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: C.ACCENT_SOFT,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  heroLabel: { color: C.TEXT_SUB, fontSize: 13, fontWeight: '600' },
  heroAmount: { color: C.ACCENT, fontSize: 36, fontWeight: '900', marginTop: 4 },
  heroSub: { color: C.TEXT_MUTED, fontSize: 13, textAlign: 'center', marginTop: 8, lineHeight: 18 },

  sectionLabel: { color: C.TEXT_MUTED, fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 10 },

  stepsCard: { backgroundColor: C.SURFACE, borderRadius: 16, borderWidth: 1, borderColor: C.BORDER, marginBottom: 24, overflow: 'hidden' },
  stepRow: { flexDirection: 'row', alignItems: 'flex-start', padding: 16, gap: 14 },
  stepRowBorder: { borderBottomWidth: 1, borderBottomColor: C.BORDER },
  stepIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: C.ACCENT_SOFT, alignItems: 'center', justifyContent: 'center' },
  stepTitle: { color: C.TEXT, fontSize: 15, fontWeight: '700' },
  stepSub: { color: C.TEXT_MUTED, fontSize: 13, marginTop: 3, lineHeight: 18 },
  stepText: { flex: 1 },

  fareCard: { backgroundColor: C.SURFACE, borderRadius: 16, borderWidth: 1, borderColor: C.BORDER, marginBottom: 24, overflow: 'hidden' },
  fareRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 13 },
  fareRowBorder: { borderBottomWidth: 1, borderBottomColor: C.BORDER },
  fareRoute: { color: C.TEXT, fontSize: 14, fontWeight: '600', flex: 1, paddingRight: 12 },
  fareAmount: { color: C.SUCCESS, fontSize: 14, fontWeight: '800' },

  logCard: { backgroundColor: C.SURFACE, borderRadius: 16, borderWidth: 1, borderColor: C.BORDER, marginBottom: 24, overflow: 'hidden' },
  logRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14 },
  logRowBorder: { borderBottomWidth: 1, borderBottomColor: C.BORDER },
  logLeft: { flex: 1, paddingRight: 12 },
  logRoute: { color: C.TEXT, fontSize: 14, fontWeight: '600' },
  logMeta: { color: C.TEXT_MUTED, fontSize: 12, marginTop: 2 },
  logAmount: { color: C.SUCCESS, fontSize: 14, fontWeight: '800' },

  payoutCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    backgroundColor: 'rgba(34,197,94,0.08)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.25)',
    marginBottom: 16,
  },
  payoutText: { flex: 1 },
  payoutTitle: { color: C.SUCCESS, fontSize: 15, fontWeight: '700' },
  payoutSub: { color: C.TEXT_SUB, fontSize: 13, marginTop: 4, lineHeight: 18 },

  contactBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: C.ACCENT,
    borderRadius: 14,
    minHeight: 52,
  },
  contactBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
});
