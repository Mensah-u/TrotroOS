import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const C = {
  BG_OVERLAY: 'rgba(0,0,0,0.78)',
  SURFACE:    '#161616',
  SURFACE_UP: '#1E1E1E',
  BORDER:     'rgba(255,255,255,0.07)',
  ACCENT:     '#F97316',
  STAR:       '#FBBF24',
  TEXT:       '#F9FAFB',
  TEXT_SUB:   '#9CA3AF',
  TEXT_MUTED: '#4B5563',
  DANGER:     '#EF4444',
};

export default function RatingModal({ visible, trip, mateName, onSubmit, onSkip }) {
  const [stars, setStars] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  useEffect(() => {
    if (visible) {
      setStars(0);
      setComment('');
      setSubmitting(false);
      setErrorMsg(null);
    }
  }, [visible, trip?.tripId, trip?.id]);

  const handleSubmit = async () => {
    if (stars === 0 || submitting) return;
    setSubmitting(true);
    setErrorMsg(null);
    try {
      await onSubmit({ stars, comment: comment.trim() || null });
    } catch (err) {
      setErrorMsg(err?.message ?? 'Could not submit rating. Try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSkip = () => {
    setStars(0);
    setComment('');
    setSubmitting(false);
    setErrorMsg(null);
    onSkip?.();
  };

  const labels = ['', 'Terrible', 'Poor', 'Okay', 'Good', 'Excellent'];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleSkip}>
      <SafeAreaView style={styles.safeRoot} edges={['top', 'bottom']}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <Pressable style={styles.backdrop} onPress={handleSkip}>
            <Pressable style={styles.sheet} onPress={() => {}}>
              <ScrollView
                contentContainerStyle={styles.sheetScroll}
                bounces={false}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}>
              <View style={styles.headerIcon}>
                <Ionicons name="checkmark-circle" size={36} color="#22C55E" />
              </View>
              <Text style={styles.title}>Trip complete!</Text>
              <Text style={styles.sub}>
                {mateName ? `How was your ride with ${mateName}?` : 'How was your ride?'}
              </Text>

              <View style={styles.starRow}>
                {[1, 2, 3, 4, 5].map((s) => (
                  <Pressable
                    key={s}
                    onPress={() => setStars(s)}
                    hitSlop={6}
                    style={({ pressed }) => [styles.starBtn, pressed && { transform: [{ scale: 0.92 }] }]}>
                    <Ionicons
                      name={s <= stars ? 'star' : 'star-outline'}
                      size={34}
                      color={s <= stars ? C.STAR : C.TEXT_MUTED}
                    />
                  </Pressable>
                ))}
              </View>

              <Text style={[styles.starLabel, stars > 0 && { color: C.STAR }]}>
                {stars > 0 ? labels[stars] : 'Tap a star to rate'}
              </Text>

              <TextInput
                style={styles.input}
                placeholder="Optional: leave a comment"
                placeholderTextColor={C.TEXT_MUTED}
                value={comment}
                onChangeText={setComment}
                multiline
                maxLength={200}
              />

              {errorMsg ? (
                <View style={styles.errorRow}>
                  <Ionicons name="alert-circle-outline" size={16} color={C.DANGER} />
                  <Text style={styles.errorText}>{errorMsg}</Text>
                </View>
              ) : null}

              <Pressable
                onPress={handleSubmit}
                disabled={stars === 0 || submitting}
                style={({ pressed }) => [
                  styles.submit,
                  (stars === 0 || submitting) && styles.submitDisabled,
                  pressed && stars > 0 && !submitting && { opacity: 0.85 },
                ]}>
                <Text style={styles.submitText}>{submitting ? 'Submitting…' : 'Submit Rating'}</Text>
              </Pressable>

              <Pressable onPress={handleSkip} style={styles.skip}>
                <Text style={styles.skipText}>Skip</Text>
              </Pressable>
              </ScrollView>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safeRoot: { flex: 1, backgroundColor: C.BG_OVERLAY },
  flex: { flex: 1 },
  backdrop: { flex: 1, justifyContent: 'center', paddingHorizontal: 20 },
  sheet: {
    backgroundColor: C.SURFACE,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: C.BORDER,
    maxHeight: '100%',
    overflow: 'hidden',
  },
  sheetScroll: { padding: 24, alignItems: 'center' },
  headerIcon: { width: 64, height: 64, borderRadius: 20, backgroundColor: 'rgba(34,197,94,0.12)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(34,197,94,0.25)', marginBottom: 16 },
  title:      { color: C.TEXT, fontSize: 22, fontWeight: '800', letterSpacing: -0.3 },
  sub:        { color: C.TEXT_SUB, fontSize: 14, textAlign: 'center', marginTop: 6, marginBottom: 24 },
  starRow:    { flexDirection: 'row', justifyContent: 'center', gap: 2, marginBottom: 8, width: '100%' },
  starBtn:    { padding: 4 },
  starLabel:  { color: C.TEXT_MUTED, fontSize: 13, fontWeight: '700', marginBottom: 20, height: 18 },
  input:      { width: '100%', minHeight: 64, backgroundColor: C.SURFACE_UP, borderRadius: 12, borderWidth: 1, borderColor: C.BORDER, paddingHorizontal: 14, paddingVertical: 12, color: C.TEXT, fontSize: 14, textAlignVertical: 'top', marginBottom: 12 },
  errorRow:   { flexDirection: 'row', alignItems: 'center', gap: 8, width: '100%', marginBottom: 12, paddingHorizontal: 4 },
  errorText:  { flex: 1, color: C.DANGER, fontSize: 13, fontWeight: '600' },
  submit:     { width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: C.ACCENT, borderRadius: 14, minHeight: 52, shadowColor: C.ACCENT, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 12 },
  submitDisabled: { backgroundColor: C.TEXT_MUTED, shadowOpacity: 0 },
  submitText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  skip:       { paddingVertical: 14 },
  skipText:   { color: C.TEXT_MUTED, fontSize: 14, fontWeight: '600' },
});
