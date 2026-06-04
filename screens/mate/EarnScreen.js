import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { TAB_BAR_CLEARANCE } from '@/constants/layout';
import { formatRoute, routes } from '@/constants/routes';
import { Theme, C } from '@/constants/theme';
import { getMateEarningsLog, getMateEarningsTotal } from '@/services/mateEarnings';
import {
  formatPayoutStatus,
  getPayoutHistory,
  MIN_PAYOUT_GHS,
  PAYOUT_NETWORKS,
  requestPayout,
} from '@/services/matePayouts';

function formatGhs(amount) {
  return `GHS ${Number(amount).toFixed(2)}`;
}

function formatDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

function PayoutModal({ visible, onClose, onSubmit }) {
  const [amount, setAmount] = useState('');
  const [momo, setMomo] = useState('');
  const [network, setNetwork] = useState('MTN');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    const amt = parseFloat(amount);
    if (!amount || isNaN(amt) || amt < MIN_PAYOUT_GHS) {
      Alert.alert('Invalid amount', `Minimum payout is GHS ${MIN_PAYOUT_GHS}.`);
      return;
    }
    if (!momo.trim() || momo.replace(/\D/g, '').length < 10) {
      Alert.alert('Invalid number', 'Enter a valid 10-digit MoMo number.');
      return;
    }
    setLoading(true);
    try {
      await onSubmit({ amountGhs: amt, momoNumber: momo.trim(), network });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={mStyles.backdrop}>
        <View style={mStyles.sheet}>
          <View style={mStyles.handle} />
          <Text style={mStyles.title}>Request Payout</Text>
          <Text style={mStyles.sub}>Processed within 1–2 business days to your MoMo wallet.</Text>

          <Text style={mStyles.label}>Amount (GHS)</Text>
          <TextInput
            style={mStyles.input}
            value={amount}
            onChangeText={setAmount}
            placeholder={`Min GHS ${MIN_PAYOUT_GHS}`}
            placeholderTextColor={C.TEXT_MUTED}
            keyboardType="decimal-pad"
          />

          <Text style={mStyles.label}>MoMo Number</Text>
          <TextInput
            style={mStyles.input}
            value={momo}
            onChangeText={setMomo}
            placeholder="0244 123 456"
            placeholderTextColor={C.TEXT_MUTED}
            keyboardType="phone-pad"
          />

          <Text style={mStyles.label}>Network</Text>
          <View style={mStyles.networkRow}>
            {PAYOUT_NETWORKS.map((n) => (
              <Pressable
                key={n}
                onPress={() => setNetwork(n)}
                style={[mStyles.networkBtn, network === n && mStyles.networkBtnActive]}>
                <Text style={[mStyles.networkBtnText, network === n && mStyles.networkBtnTextActive]}>
                  {n}
                </Text>
              </Pressable>
            ))}
          </View>

          <Pressable
            onPress={handleSubmit}
            disabled={loading}
            style={({ pressed }) => [mStyles.submitBtn, pressed && { opacity: 0.85 }, loading && { opacity: 0.6 }]}>
            <Text style={mStyles.submitBtnText}>{loading ? 'Submitting…' : 'Submit Request'}</Text>
          </Pressable>
          <Pressable onPress={onClose} style={mStyles.cancelBtn}>
            <Text style={mStyles.cancelBtnText}>Cancel</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

export default function EarnScreen({ navigation }) {
  const [total, setTotal] = useState(0);
  const [log, setLog] = useState([]);
  const [payoutHistory, setPayoutHistory] = useState([]);
  const [payoutModal, setPayoutModal] = useState(false);

  const refresh = useCallback(async () => {
    const [t, l, { data: ph }] = await Promise.all([
      getMateEarningsTotal(),
      getMateEarningsLog(),
      getPayoutHistory(),
    ]);
    setTotal(t);
    setLog(l);
    setPayoutHistory(ph);
  }, []);

  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));

  const handlePayoutSubmit = async ({ amountGhs, momoNumber, network }) => {
    const { ok, error, message } = await requestPayout({ amountGhs, momoNumber, network });
    if (!ok) {
      Alert.alert('Payout request failed', error);
      return;
    }
    setPayoutModal(false);
    Alert.alert('Payout requested', message);
    refresh();
  };

  const pendingPayout = payoutHistory.find((p) => p.status === 'pending' || p.status === 'processing');

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

        {/* ── Earnings hero ── */}
        <View style={styles.heroCard}>
          <View style={styles.heroIcon}>
            <Ionicons name="wallet" size={28} color={C.ACCENT} />
          </View>
          <Text style={styles.heroLabel}>Total earnings</Text>
          <Text style={styles.heroAmount}>{formatGhs(total)}</Text>
          <Text style={styles.heroSub}>Track fares from every passenger you onboard.</Text>

          {total >= MIN_PAYOUT_GHS && !pendingPayout ? (
            <Pressable
              onPress={() => setPayoutModal(true)}
              style={({ pressed }) => [styles.payoutHeroBtn, pressed && { opacity: 0.85 }]}>
              <Ionicons name="arrow-up-circle-outline" size={18} color="#fff" />
              <Text style={styles.payoutHeroBtnText}>Request MoMo Payout</Text>
            </Pressable>
          ) : pendingPayout ? (
            <View style={styles.pendingBadge}>
              <Ionicons name="time-outline" size={15} color="#FCD34D" />
              <Text style={styles.pendingBadgeText}>
                Payout {pendingPayout.status} — {formatGhs(pendingPayout.amount_ghs)}
              </Text>
            </View>
          ) : (
            <Text style={styles.heroSubMuted}>
              Earn GHS {MIN_PAYOUT_GHS}+ to unlock payouts.
            </Text>
          )}
        </View>

        {/* ── How it works ── */}
        <Text style={styles.sectionLabel}>HOW IT WORKS</Text>
        <View style={styles.stepsCard}>
          {[
            { icon: 'play-circle-outline', title: 'Start a trip', sub: 'Pick your route and depart on the Mate dashboard.' },
            { icon: 'person-add-outline', title: 'Onboard passengers', sub: 'Tap +1 ONBOARDED each time someone boards.' },
            { icon: 'cash-outline', title: 'Earn per passenger', sub: 'Your trip earnings update instantly on the dashboard.' },
            { icon: 'arrow-up-circle-outline', title: 'Request payout', sub: `Once you reach GHS ${MIN_PAYOUT_GHS}, tap Request MoMo Payout above.` },
          ].map((step, i) => (
            <View key={step.title} style={[styles.stepRow, i < 3 && styles.stepRowBorder]}>
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

        {/* ── Fare table ── */}
        <Text style={styles.sectionLabel}>FARE TABLE (Kumasi)</Text>
        <View style={styles.fareCard}>
          {routes.map((route, i) => (
            <View key={route.id} style={[styles.fareRow, i < routes.length - 1 && styles.fareRowBorder]}>
              <Text style={styles.fareRoute} numberOfLines={1}>{formatRoute(route)}</Text>
              <Text style={styles.fareAmount}>GHS {route.fareGhs}</Text>
            </View>
          ))}
        </View>

        {/* ── Recent trips ── */}
        {log.length > 0 ? (
          <>
            <Text style={styles.sectionLabel}>RECENT TRIPS</Text>
            <View style={styles.logCard}>
              {log.slice(0, 10).map((entry, i) => (
                <View key={`${entry.at}-${i}`} style={[styles.logRow, i < Math.min(log.length, 10) - 1 && styles.logRowBorder]}>
                  <View style={styles.logLeft}>
                    <Text style={styles.logRoute} numberOfLines={1}>{entry.route}</Text>
                    <Text style={styles.logMeta}>
                      {entry.passengers} passenger{entry.passengers === 1 ? '' : 's'} · {formatDate(entry.at)}
                    </Text>
                  </View>
                  <Text style={styles.logAmount}>+{formatGhs(entry.amountGhs)}</Text>
                </View>
              ))}
            </View>
          </>
        ) : null}

        {/* ── Payout history ── */}
        {payoutHistory.length > 0 ? (
          <>
            <Text style={styles.sectionLabel}>PAYOUT HISTORY</Text>
            <View style={styles.logCard}>
              {payoutHistory.slice(0, 8).map((p, i) => {
                const s = formatPayoutStatus(p.status);
                return (
                  <View key={p.id} style={[styles.logRow, i < Math.min(payoutHistory.length, 8) - 1 && styles.logRowBorder]}>
                    <View style={styles.logLeft}>
                      <Text style={styles.logRoute} numberOfLines={1}>
                        {p.momo_number} · {p.network}
                      </Text>
                      <Text style={styles.logMeta}>{formatDate(p.requested_at)}</Text>
                      {p.admin_note ? (
                        <Text style={[styles.logMeta, { color: '#F87171', marginTop: 2 }]} numberOfLines={2}>
                          {p.admin_note}
                        </Text>
                      ) : null}
                    </View>
                    <View style={styles.payoutRight}>
                      <Text style={styles.logAmount}>{formatGhs(p.amount_ghs)}</Text>
                      <View style={[styles.statusBadge, { borderColor: s.color }]}>
                        <Text style={[styles.statusBadgeText, { color: s.color }]}>{s.label}</Text>
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          </>
        ) : null}

      </ScrollView>

      <PayoutModal
        visible={payoutModal}
        onClose={() => setPayoutModal(false)}
        onSubmit={handlePayoutSubmit}
      />
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
    width: 56, height: 56, borderRadius: 16,
    backgroundColor: C.ACCENT_SOFT,
    alignItems: 'center', justifyContent: 'center', marginBottom: 12,
  },
  heroLabel: { color: C.TEXT_SUB, fontSize: 13, fontWeight: '600' },
  heroAmount: { color: C.ACCENT, fontSize: 36, fontWeight: '900', marginTop: 4 },
  heroSub: { color: C.TEXT_MUTED, fontSize: 13, textAlign: 'center', marginTop: 8, lineHeight: 18 },
  heroSubMuted: { color: C.TEXT_MUTED, fontSize: 12, marginTop: 10 },

  payoutHeroBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: C.ACCENT, borderRadius: 12,
    paddingVertical: 12, paddingHorizontal: 20, marginTop: 16,
  },
  payoutHeroBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },

  pendingBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(252,211,77,0.1)', borderRadius: 10,
    paddingVertical: 8, paddingHorizontal: 14, marginTop: 14,
    borderWidth: 1, borderColor: 'rgba(252,211,77,0.3)',
  },
  pendingBadgeText: { color: '#FCD34D', fontSize: 13, fontWeight: '600' },

  sectionLabel: { color: C.TEXT_MUTED, fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 10 },

  stepsCard: {
    backgroundColor: C.SURFACE, borderRadius: 16,
    borderWidth: 1, borderColor: C.BORDER, marginBottom: 24, overflow: 'hidden',
  },
  stepRow: { flexDirection: 'row', alignItems: 'flex-start', padding: 16, gap: 14 },
  stepRowBorder: { borderBottomWidth: 1, borderBottomColor: C.BORDER },
  stepIcon: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: C.ACCENT_SOFT, alignItems: 'center', justifyContent: 'center',
  },
  stepTitle: { color: C.TEXT, fontSize: 15, fontWeight: '700' },
  stepSub: { color: C.TEXT_MUTED, fontSize: 13, marginTop: 3, lineHeight: 18 },
  stepText: { flex: 1 },

  fareCard: {
    backgroundColor: C.SURFACE, borderRadius: 16,
    borderWidth: 1, borderColor: C.BORDER, marginBottom: 24, overflow: 'hidden',
  },
  fareRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 13,
  },
  fareRowBorder: { borderBottomWidth: 1, borderBottomColor: C.BORDER },
  fareRoute: { color: C.TEXT, fontSize: 14, fontWeight: '600', flex: 1, paddingRight: 12 },
  fareAmount: { color: C.SUCCESS, fontSize: 14, fontWeight: '800' },

  logCard: {
    backgroundColor: C.SURFACE, borderRadius: 16,
    borderWidth: 1, borderColor: C.BORDER, marginBottom: 24, overflow: 'hidden',
  },
  logRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', padding: 14,
  },
  logRowBorder: { borderBottomWidth: 1, borderBottomColor: C.BORDER },
  logLeft: { flex: 1, paddingRight: 12 },
  logRoute: { color: C.TEXT, fontSize: 14, fontWeight: '600' },
  logMeta: { color: C.TEXT_MUTED, fontSize: 12, marginTop: 2 },
  logAmount: { color: C.SUCCESS, fontSize: 14, fontWeight: '800' },
  payoutRight: { alignItems: 'flex-end', gap: 4 },
  statusBadge: {
    borderWidth: 1, borderRadius: 6,
    paddingHorizontal: 6, paddingVertical: 2,
  },
  statusBadgeText: { fontSize: 11, fontWeight: '700' },
});

const mStyles = StyleSheet.create({
  backdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Theme.colors.card,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, paddingBottom: 36, gap: 14,
  },
  handle: {
    alignSelf: 'center',
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: Theme.colors.border, marginBottom: 4,
  },
  title: { color: Theme.colors.text, fontSize: 20, fontWeight: '800' },
  sub: { color: Theme.colors.textMuted, fontSize: 14, lineHeight: 20, marginTop: -4 },
  label: { color: Theme.colors.textSoft, fontSize: 13, fontWeight: '600', marginBottom: -6 },
  input: {
    borderWidth: 1, borderColor: Theme.colors.border, borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 12,
    color: Theme.colors.text, fontSize: 16,
  },
  networkRow: { flexDirection: 'row', gap: 10 },
  networkBtn: {
    flex: 1, paddingVertical: 10, borderRadius: 10,
    borderWidth: 1, borderColor: Theme.colors.border,
    alignItems: 'center',
  },
  networkBtnActive: {
    backgroundColor: Theme.colors.primary + '22',
    borderColor: Theme.colors.primary,
  },
  networkBtnText: { color: Theme.colors.textMuted, fontWeight: '600', fontSize: 14 },
  networkBtnTextActive: { color: Theme.colors.primary },
  submitBtn: {
    backgroundColor: Theme.colors.primary, borderRadius: 12,
    paddingVertical: 14, alignItems: 'center', marginTop: 4,
  },
  submitBtnText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  cancelBtn: { alignItems: 'center', paddingVertical: 10 },
  cancelBtnText: { color: Theme.colors.textMuted, fontSize: 15 },
});
