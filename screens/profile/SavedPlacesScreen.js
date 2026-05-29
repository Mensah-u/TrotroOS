import { Ionicons } from '@expo/vector-icons';
import { useCallback, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';

import ProfileHeader from '@/components/ProfileHeader';
import { placeCoords } from '@/constants/routes';
import { TAB_BAR_CLEARANCE } from '@/constants/layout';
import { Theme } from '@/constants/theme';
import {
  addCustomPlace,
  getSavedPlaces,
  removeSavedPlace,
  updateSavedPlace,
} from '@/services/savedPlaces';

const SUGGESTIONS = Object.keys(placeCoords);

export default function SavedPlacesScreen({ navigation }) {
  const [places, setPlaces] = useState([]);
  const [editing, setEditing] = useState(null);
  const [draftValue, setDraftValue] = useState('');
  const [draftLabel, setDraftLabel] = useState('');
  const [adding, setAdding] = useState(false);

  useFocusEffect(
    useCallback(() => {
      getSavedPlaces().then(setPlaces);
    }, []),
  );

  const startEdit = (place) => {
    setEditing(place.id);
    setDraftValue(place.name ?? '');
    setDraftLabel(place.label ?? '');
  };

  const cancelEdit = () => {
    setEditing(null);
    setAdding(false);
    setDraftValue('');
    setDraftLabel('');
  };

  const saveEdit = async () => {
    const trimmed = draftValue.trim();
    if (!trimmed) {
      Alert.alert('Address required', 'Please enter a place or station.');
      return;
    }
    if (adding) {
      const next = await addCustomPlace({ label: draftLabel || 'Saved place', name: trimmed });
      setPlaces(next);
    } else if (editing) {
      const patch = { name: trimmed };
      if (places.find((p) => p.id === editing)?.kind === 'custom') {
        patch.label = draftLabel?.trim() || 'Saved place';
      }
      const next = await updateSavedPlace(editing, patch);
      setPlaces(next);
    }
    cancelEdit();
  };

  const remove = (place) => {
    Alert.alert('Remove saved place?', place.label, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          const next = await removeSavedPlace(place.id);
          setPlaces(next);
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ProfileHeader navigation={navigation} title="Saved Places" />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.intro}>
            Save your favorite stops for one-tap pickup and drop-off when finding a ride.
          </Text>

          {places.map((place) => {
            const isEditing = editing === place.id;
            return (
              <View key={place.id} style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={styles.iconWrap}>
                    <Ionicons name={place.icon} size={20} color={Theme.colors.passenger} />
                  </View>
                  <View style={styles.cardText}>
                    {isEditing && place.kind === 'custom' ? (
                      <TextInput
                        style={styles.labelInput}
                        value={draftLabel}
                        onChangeText={setDraftLabel}
                        placeholder="Label (e.g. Gym)"
                        placeholderTextColor={Theme.colors.textMuted}
                      />
                    ) : (
                      <Text style={styles.label}>{place.label}</Text>
                    )}
                    <Text style={styles.placeName}>
                      {place.name || 'Not set'}
                    </Text>
                  </View>
                  {!isEditing && place.kind === 'custom' ? (
                    <Pressable onPress={() => remove(place)} hitSlop={10} style={styles.iconBtn}>
                      <Ionicons name="trash-outline" size={16} color={Theme.colors.danger} />
                    </Pressable>
                  ) : null}
                </View>

                {isEditing ? (
                  <View style={styles.editBox}>
                    <TextInput
                      style={styles.input}
                      value={draftValue}
                      onChangeText={setDraftValue}
                      placeholder="Type a station or place"
                      placeholderTextColor={Theme.colors.textMuted}
                      autoFocus
                    />
                    <View style={styles.suggestionRow}>
                      {SUGGESTIONS.map((s) => (
                        <Pressable
                          key={s}
                          onPress={() => setDraftValue(s)}
                          style={({ pressed }) => [styles.suggestion, pressed && { opacity: 0.7 }]}>
                          <Text style={styles.suggestionText}>{s}</Text>
                        </Pressable>
                      ))}
                    </View>
                    <View style={styles.actions}>
                      <Pressable onPress={cancelEdit} style={({ pressed }) => [styles.btnGhost, pressed && { opacity: 0.7 }]}>
                        <Text style={styles.btnGhostText}>Cancel</Text>
                      </Pressable>
                      <Pressable onPress={saveEdit} style={({ pressed }) => [styles.btnPrimary, pressed && { opacity: 0.85 }]}>
                        <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                        <Text style={styles.btnPrimaryText}>Save</Text>
                      </Pressable>
                    </View>
                  </View>
                ) : (
                  <Pressable
                    onPress={() => startEdit(place)}
                    style={({ pressed }) => [styles.editBtn, pressed && { opacity: 0.7 }]}>
                    <Ionicons name="create-outline" size={14} color={Theme.colors.passenger} />
                    <Text style={styles.editBtnText}>
                      {place.name ? 'Edit' : 'Set address'}
                    </Text>
                  </Pressable>
                )}
              </View>
            );
          })}

          {!adding ? (
            <Pressable
              onPress={() => {
                setAdding(true);
                setEditing(null);
                setDraftLabel('');
                setDraftValue('');
              }}
              style={({ pressed }) => [styles.addBtn, pressed && { opacity: 0.85 }]}>
              <Ionicons name="add-circle-outline" size={18} color={Theme.colors.passenger} />
              <Text style={styles.addBtnText}>Add another place</Text>
            </Pressable>
          ) : (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.iconWrap}>
                  <Ionicons name="bookmark-outline" size={20} color={Theme.colors.passenger} />
                </View>
                <View style={styles.cardText}>
                  <TextInput
                    style={styles.labelInput}
                    value={draftLabel}
                    onChangeText={setDraftLabel}
                    placeholder="Label (e.g. Gym)"
                    placeholderTextColor={Theme.colors.textMuted}
                  />
                </View>
              </View>
              <View style={styles.editBox}>
                <TextInput
                  style={styles.input}
                  value={draftValue}
                  onChangeText={setDraftValue}
                  placeholder="Type a station or place"
                  placeholderTextColor={Theme.colors.textMuted}
                  autoFocus
                />
                <View style={styles.suggestionRow}>
                  {SUGGESTIONS.map((s) => (
                    <Pressable
                      key={s}
                      onPress={() => setDraftValue(s)}
                      style={({ pressed }) => [styles.suggestion, pressed && { opacity: 0.7 }]}>
                      <Text style={styles.suggestionText}>{s}</Text>
                    </Pressable>
                  ))}
                </View>
                <View style={styles.actions}>
                  <Pressable onPress={cancelEdit} style={({ pressed }) => [styles.btnGhost, pressed && { opacity: 0.7 }]}>
                    <Text style={styles.btnGhostText}>Cancel</Text>
                  </Pressable>
                  <Pressable onPress={saveEdit} style={({ pressed }) => [styles.btnPrimary, pressed && { opacity: 0.85 }]}>
                    <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                    <Text style={styles.btnPrimaryText}>Save place</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Theme.colors.bgElevated },
  content: { padding: 20, paddingBottom: TAB_BAR_CLEARANCE },
  intro: { color: Theme.colors.textSub, fontSize: 14, lineHeight: 20, marginBottom: 16 },
  card: {
    backgroundColor: Theme.colors.surface,
    borderRadius: Theme.radius.lg,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Theme.colors.border,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconWrap: {
    width: 38, height: 38, borderRadius: 12,
    backgroundColor: Theme.colors.passengerSoft,
    alignItems: 'center', justifyContent: 'center',
  },
  cardText: { flex: 1 },
  label: { color: Theme.colors.text, fontSize: 15, fontWeight: '700' },
  placeName: { color: Theme.colors.textSub, fontSize: 13, marginTop: 2 },
  labelInput: {
    color: Theme.colors.text, fontSize: 15, fontWeight: '700',
    borderBottomWidth: 1, borderBottomColor: Theme.colors.border, paddingBottom: 4,
  },
  iconBtn: { padding: 6 },
  editBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 10, alignSelf: 'flex-start' },
  editBtnText: { color: Theme.colors.passenger, fontSize: 13, fontWeight: '700' },
  editBox: { marginTop: 12 },
  input: {
    backgroundColor: Theme.colors.surfaceUp,
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10,
    color: Theme.colors.text, fontSize: 14,
    borderWidth: 1, borderColor: Theme.colors.border,
  },
  suggestionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  suggestion: {
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8,
    backgroundColor: Theme.colors.surfaceUp,
    borderWidth: 1, borderColor: Theme.colors.border,
  },
  suggestionText: { color: Theme.colors.textSub, fontSize: 12, fontWeight: '600' },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 12 },
  btnGhost: { paddingHorizontal: 14, paddingVertical: 10 },
  btnGhostText: { color: Theme.colors.textSub, fontSize: 14, fontWeight: '700' },
  btnPrimary: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Theme.colors.passenger,
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10,
  },
  btnPrimaryText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  addBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 14, borderRadius: 12,
    borderWidth: 1, borderStyle: 'dashed', borderColor: Theme.colors.passenger + '66',
    marginTop: 4,
  },
  addBtnText: { color: Theme.colors.passenger, fontSize: 14, fontWeight: '700' },
});
