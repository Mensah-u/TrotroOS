import { Ionicons } from '@expo/vector-icons';
import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';

import ProfileHeader from '@/components/ProfileHeader';
import { TAB_BAR_CLEARANCE } from '@/constants/layout';
import { Theme } from '@/constants/theme';
import {
  VERIFICATION_STEPS,
  computeVerificationLevel,
  getMateVerification,
  markVerificationStep,
} from '@/services/mateVerification';

export default function MateVerificationScreen({ navigation }) {
  const [state, setState] = useState({});

  useFocusEffect(
    useCallback(() => {
      getMateVerification().then(setState);
    }, []),
  );

  const summary = computeVerificationLevel(state);

  const toggle = (step) => {
    const next = !state[step.id];
    if (next) {
      Alert.alert(
        `Mark ${step.label.toLowerCase()} as submitted?`,
        'A team member will review your document. Marking it as submitted here is a draft until backend KYC is live.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Mark submitted',
            onPress: async () => {
              await markVerificationStep(step.id, true);
              setState((s) => ({ ...s, [step.id]: true }));
            },
          },
        ],
      );
    } else {
      markVerificationStep(step.id, false);
      setState((s) => ({ ...s, [step.id]: false }));
    }
  };

  const levelColor =
    summary.level === 'verified' ? Theme.colors.success :
    summary.level === 'partial' ? Theme.colors.gold :
    Theme.colors.textMuted;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ProfileHeader navigation={navigation} title="Verification" />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={[styles.statusCard, { borderColor: levelColor + '55' }]}>
          <View style={[styles.statusIcon, { backgroundColor: levelColor + '22' }]}>
            <Ionicons
              name={summary.level === 'verified' ? 'shield-checkmark' : 'shield-half'}
              size={28}
              color={levelColor}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.statusLabel, { color: levelColor }]}>{summary.label}</Text>
            <Text style={styles.statusSub}>
              {summary.done} of {summary.total} verification steps completed
            </Text>
            <View style={styles.progressBar}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${(summary.done / summary.total) * 100}%`, backgroundColor: levelColor },
                ]}
              />
            </View>
          </View>
        </View>

        <Text style={styles.sectionLabel}>VERIFICATION STEPS</Text>
        <View style={styles.card}>
          {VERIFICATION_STEPS.map((step, idx) => {
            const done = !!state[step.id];
            return (
              <View key={step.id}>
                <Pressable
                  onPress={() => toggle(step)}
                  style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}>
                  <View style={[styles.iconWrap, done && styles.iconWrapDone]}>
                    <Ionicons name={step.icon} size={18} color={done ? Theme.colors.success : Theme.colors.textSub} />
                  </View>
                  <View style={styles.rowText}>
                    <Text style={styles.rowLabel}>{step.label}</Text>
                    <Text style={styles.rowSub}>{step.description}</Text>
                  </View>
                  {done ? (
                    <Ionicons name="checkmark-circle" size={20} color={Theme.colors.success} />
                  ) : (
                    <View style={styles.pendingPill}>
                      <Text style={styles.pendingText}>Pending</Text>
                    </View>
                  )}
                </Pressable>
                {idx < VERIFICATION_STEPS.length - 1 ? <View style={styles.divider} /> : null}
              </View>
            );
          })}
        </View>

        <View style={styles.tipCard}>
          <Ionicons name="lock-closed-outline" size={16} color={Theme.colors.textSub} />
          <Text style={styles.tipText}>
            Verification builds passenger trust and unlocks priority placement in route searches. Document upload coming soon.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Theme.colors.bgElevated },
  content: { padding: 20, paddingBottom: TAB_BAR_CLEARANCE },
  statusCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: Theme.colors.surface,
    borderRadius: Theme.radius.lg, padding: 16,
    borderWidth: 1,
    marginBottom: 20,
  },
  statusIcon: {
    width: 56, height: 56, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
  },
  statusLabel: { fontSize: 16, fontWeight: '900' },
  statusSub: { color: Theme.colors.textSub, fontSize: 13, marginTop: 4 },
  progressBar: {
    height: 6, backgroundColor: Theme.colors.surfaceUp,
    borderRadius: 3, marginTop: 10, overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: 3 },
  sectionLabel: { color: Theme.colors.textMuted, fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 10 },
  card: {
    backgroundColor: Theme.colors.surface,
    borderRadius: Theme.radius.lg,
    borderWidth: 1, borderColor: Theme.colors.border,
    overflow: 'hidden', marginBottom: 16,
  },
  row: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
  iconWrap: {
    width: 38, height: 38, borderRadius: 12,
    backgroundColor: Theme.colors.surfaceUp,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Theme.colors.border,
  },
  iconWrapDone: { backgroundColor: Theme.colors.successSoft, borderColor: 'rgba(34,197,94,0.3)' },
  rowText: { flex: 1 },
  rowLabel: { color: Theme.colors.text, fontSize: 14, fontWeight: '700' },
  rowSub: { color: Theme.colors.textMuted, fontSize: 12, marginTop: 2 },
  pendingPill: {
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(251,191,36,0.12)',
    borderWidth: 1, borderColor: 'rgba(251,191,36,0.3)',
  },
  pendingText: { color: Theme.colors.gold, fontSize: 11, fontWeight: '700', letterSpacing: 0.3 },
  divider: { height: 1, backgroundColor: Theme.colors.border, marginLeft: 60 },
  tipCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    backgroundColor: Theme.colors.surface,
    borderRadius: Theme.radius.lg, padding: 14,
    borderWidth: 1, borderColor: Theme.colors.border,
  },
  tipText: { flex: 1, color: Theme.colors.textSub, fontSize: 13, lineHeight: 19 },
});
