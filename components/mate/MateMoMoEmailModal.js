import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Theme } from '@/constants/theme';

/**
 * Collect / confirm MoMo email for mate invite Paystack checkout.
 */
export default function MateMoMoEmailModal({
  visible,
  initialEmail = '',
  onCancel,
  onSubmit,
}) {
  const [email, setEmail] = useState(initialEmail);

  useEffect(() => {
    if (visible) setEmail(initialEmail);
  }, [visible, initialEmail]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>MoMo email</Text>
          <Text style={styles.sub}>
            Paystack needs the email linked to your Mobile Money wallet for invite fees.
          </Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            placeholderTextColor={Theme.colors.textMuted}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />
          <View style={styles.actions}>
            <Pressable onPress={onCancel} style={styles.btnGhost}>
              <Text style={styles.btnGhostText}>Cancel</Text>
            </Pressable>
            <Pressable onPress={() => onSubmit?.(email)} style={styles.btnPrimary}>
              <Text style={styles.btnPrimaryText}>Continue</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: Theme.colors.card,
    borderRadius: 16,
    padding: 20,
    gap: 12,
  },
  title: { color: Theme.colors.text, fontSize: 18, fontWeight: '700' },
  sub: { color: Theme.colors.textMuted, fontSize: 14, lineHeight: 20 },
  input: {
    borderWidth: 1,
    borderColor: Theme.colors.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: Theme.colors.text,
    fontSize: 16,
  },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 4 },
  btnGhost: { paddingVertical: 10, paddingHorizontal: 14 },
  btnGhostText: { color: Theme.colors.textMuted, fontSize: 15 },
  btnPrimary: {
    backgroundColor: Theme.colors.primary,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 18,
  },
  btnPrimaryText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
