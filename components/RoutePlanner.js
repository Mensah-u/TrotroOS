import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  findRouteByPlaces,
  getAllPlaces,
  getDestinationsForOrigin,
  getOrigins,
  popularRoutes,
} from '@/constants/routes';
import { SCREEN_GUTTER } from '@/constants/layout';
import { Theme, glowShadow } from '@/constants/theme';
import { hapticSelect } from '@/utils/haptics';
import { estimateTripDuration } from '@/utils/rideEta';
import { getSavedPlaces } from '@/services/savedPlaces';
import { getRecentPlaces, rememberRecentPlace } from '@/services/recentPlaces';
import { getMyLocationLabel } from '@/utils/myLocation';

export default function RoutePlanner({
  fromPlace,
  toPlace,
  onChangeFrom,
  onChangeTo,
  onSwap,
  passengerCoords,
}) {
  const insets = useSafeAreaInsets();
  const [picker, setPicker] = useState(null); // 'from' | 'to'
  const [query, setQuery] = useState('');
  const [savedPlaces, setSavedPlaces] = useState([]);
  const [recentPlaces, setRecentPlaces] = useState([]);
  const [locating, setLocating] = useState(false);

  const selectedRoute = useMemo(
    () => findRouteByPlaces(fromPlace, toPlace),
    [fromPlace, toPlace],
  );

  const tripDuration = useMemo(
    () => estimateTripDuration({
      origin: fromPlace,
      destination: toPlace,
      routeMeta: selectedRoute,
    }),
    [fromPlace, toPlace, selectedRoute],
  );

  // Predefined options for the current picker field.
  const baseOptions = useMemo(() => {
    if (picker === 'from') return getOrigins();
    if (picker === 'to') {
      // If origin is known + has linked destinations, use those.
      // Otherwise fall back to every known place so we don't dead-end.
      const linked = getDestinationsForOrigin(fromPlace);
      if (linked && linked.length > 0) return linked;
      return getAllPlaces();
    }
    return [];
  }, [picker, fromPlace]);

  // Load saved + recents whenever picker opens.
  useEffect(() => {
    if (picker === null) return;
    let cancelled = false;
    (async () => {
      const [saved, recents] = await Promise.all([
        getSavedPlaces().catch(() => []),
        getRecentPlaces().catch(() => []),
      ]);
      if (cancelled) return;
      setSavedPlaces((saved ?? []).filter((p) => p?.name?.trim()));
      setRecentPlaces(recents ?? []);
    })();
    return () => { cancelled = true; };
  }, [picker]);

  const openPicker = (field) => {
    hapticSelect();
    setQuery('');
    setPicker(field);
  };

  const closePicker = useCallback(() => {
    setPicker(null);
    setQuery('');
  }, []);

  const pickMyLocation = useCallback(async () => {
    if (locating) return;
    setLocating(true);
    try {
      const res = await getMyLocationLabel({ existingCoords: passengerCoords });
      if (!res.ok) {
        Alert.alert(
          'Can\u2019t use your location',
          res.error === 'Location permission denied'
            ? 'Allow location access in Settings to use this feature.'
            : 'We couldn\u2019t pick up your GPS right now. Try again or type your spot.',
        );
        return;
      }
      hapticSelect();
      if (picker === 'from') onChangeFrom(res.label);
      else if (picker === 'to') onChangeTo(res.label);
      const next = await rememberRecentPlace(res.label);
      setRecentPlaces(next);
      closePicker();
    } finally {
      setLocating(false);
    }
  }, [locating, passengerCoords, picker, onChangeFrom, onChangeTo, closePicker]);

  const commitPlace = useCallback(async (rawPlace, { remember = false } = {}) => {
    const place = String(rawPlace ?? '').trim();
    if (!place) return;
    hapticSelect();

    if (picker === 'from') {
      onChangeFrom(place);
      if (toPlace) {
        const linked = getDestinationsForOrigin(place);
        if (linked && linked.length > 0 && !linked.includes(toPlace)) {
          onChangeTo(null);
        }
      }
    } else if (picker === 'to') {
      onChangeTo(place);
    }

    if (remember) {
      const next = await rememberRecentPlace(place);
      setRecentPlaces(next);
    }

    closePicker();
  }, [picker, toPlace, onChangeFrom, onChangeTo, closePicker]);

  const trimmedQuery = query.trim();
  const lowerQuery = trimmedQuery.toLowerCase();

  const filteredOptions = useMemo(() => {
    if (!lowerQuery) return baseOptions;
    return baseOptions.filter((p) => p.toLowerCase().includes(lowerQuery));
  }, [baseOptions, lowerQuery]);

  const filteredSaved = useMemo(() => {
    if (!savedPlaces.length) return [];
    if (!lowerQuery) return savedPlaces;
    return savedPlaces.filter(
      (p) =>
        p.label?.toLowerCase().includes(lowerQuery) ||
        p.name?.toLowerCase().includes(lowerQuery),
    );
  }, [savedPlaces, lowerQuery]);

  const filteredRecents = useMemo(() => {
    if (!recentPlaces.length) return [];
    if (!lowerQuery) return recentPlaces;
    return recentPlaces.filter((p) => p.toLowerCase().includes(lowerQuery));
  }, [recentPlaces, lowerQuery]);

  // Should we expose "Use my own location" CTA?
  const hasExactMatch = useMemo(() => {
    if (!trimmedQuery) return true;
    return baseOptions.some((p) => p.toLowerCase() === lowerQuery);
  }, [baseOptions, trimmedQuery, lowerQuery]);

  const canSwap = fromPlace && toPlace && findRouteByPlaces(toPlace, fromPlace);

  return (
    <View style={styles.wrap}>
      <View style={styles.card}>
        <View style={styles.routeVisual}>
          <View style={styles.dotsCol}>
            <View style={[styles.dot, styles.dotFrom]} />
            <View style={styles.line} />
            <View style={[styles.dot, styles.dotTo]} />
          </View>

          <View style={styles.fieldsCol}>
            <Pressable onPress={() => openPicker('from')} style={styles.fieldRow}>
              <Text style={styles.fieldLabel}>From</Text>
              <Text style={[styles.fieldValue, !fromPlace && styles.fieldPlaceholder]} numberOfLines={1}>
                {fromPlace ?? 'Where are you now?'}
              </Text>
              <Ionicons name="chevron-down" size={18} color={Theme.colors.textMuted} />
            </Pressable>

            <View style={styles.fieldDivider} />

            <Pressable
              onPress={() => openPicker('to')}
              style={styles.fieldRow}
              disabled={!fromPlace}>
              <Text style={styles.fieldLabel}>To</Text>
              <Text
                style={[
                  styles.fieldValue,
                  !toPlace && styles.fieldPlaceholder,
                  !fromPlace && styles.fieldDisabled,
                ]}
                numberOfLines={1}>
                {toPlace ?? (fromPlace ? 'Where are you going?' : 'Pick departure first')}
              </Text>
              <Ionicons name="chevron-down" size={18} color={Theme.colors.textMuted} />
            </Pressable>
          </View>

          {canSwap ? (
            <Pressable onPress={onSwap} hitSlop={10} style={styles.swapBtn}>
              <Ionicons name="swap-vertical" size={20} color={Theme.colors.passenger} />
            </Pressable>
          ) : null}
        </View>

        {fromPlace && toPlace ? (
          <View style={styles.metaRow}>
            {selectedRoute ? (
              <View style={styles.fareRow}>
                <Ionicons name="cash-outline" size={16} color={Theme.colors.success} />
                <Text style={styles.fareText}>GHS {selectedRoute.fareGhs}</Text>
              </View>
            ) : null}
            {tripDuration ? (
              <View style={styles.durationRow}>
                <Ionicons name="time-outline" size={16} color={Theme.colors.passenger} />
                <Text style={styles.durationText}>
                  {tripDuration.label} trip
                </Text>
              </View>
            ) : null}
          </View>
        ) : null}
      </View>

      {!fromPlace || !toPlace ? (
        <View style={styles.quickSection}>
          <Text style={styles.quickLabel}>QUICK ROUTES — TAP ONE</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickScroll}>
            {popularRoutes.map((route) => (
              <Pressable
                key={route.id}
                onPress={() => {
                  hapticSelect();
                  onChangeFrom(route.origin);
                  onChangeTo(route.destination);
                }}
                style={({ pressed }) => [styles.quickChip, pressed && { opacity: 0.85 }]}>
                <Text style={styles.quickChipTitle} numberOfLines={1}>{route.origin}</Text>
                <Ionicons name="arrow-forward" size={12} color={Theme.colors.passenger} />
                <Text style={styles.quickChipTitle} numberOfLines={1}>{route.destination}</Text>
                <Text style={styles.quickChipFare}>GHS {route.fareGhs}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      ) : null}

      <Modal visible={picker !== null} transparent animationType="slide" onRequestClose={closePicker}>
        <Pressable style={styles.modalBackdrop} onPress={closePicker}>
          <Pressable
            style={[styles.modalSheet, { paddingBottom: Math.max(insets.bottom, 16) + 16 }]}
            onPress={() => {}}>
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : undefined}
              keyboardVerticalOffset={20}>
              <View style={styles.modalHandle} />
              <Text style={styles.modalTitle}>
                {picker === 'from' ? 'Leaving from' : 'Going to'}
              </Text>
              <Text style={styles.modalHint}>
                Type any spot or pick from the suggestions
              </Text>

              <View style={styles.searchBox}>
                <Ionicons name="search-outline" size={18} color={Theme.colors.textMuted} />
                <TextInput
                  value={query}
                  onChangeText={setQuery}
                  placeholder={picker === 'from' ? 'e.g. Aboabo, Asuoyeboah…' : 'e.g. KNUST, Bantama Market…'}
                  placeholderTextColor={Theme.colors.textMuted}
                  style={styles.searchInput}
                  autoCapitalize="words"
                  autoCorrect={false}
                  returnKeyType="go"
                  onSubmitEditing={() => {
                    if (trimmedQuery) commitPlace(trimmedQuery, { remember: true });
                  }}
                />
                {trimmedQuery ? (
                  <Pressable onPress={() => setQuery('')} hitSlop={10}>
                    <Ionicons name="close-circle" size={18} color={Theme.colors.textMuted} />
                  </Pressable>
                ) : null}
              </View>

              <Pressable
                onPress={pickMyLocation}
                disabled={locating}
                style={({ pressed }) => [
                  styles.myLocationRow,
                  pressed && { opacity: 0.85 },
                  locating && { opacity: 0.7 },
                ]}>
                <View style={styles.myLocationIcon}>
                  {locating ? (
                    <ActivityIndicator size="small" color={Theme.colors.passenger} />
                  ) : (
                    <Ionicons name="locate" size={18} color={Theme.colors.passenger} />
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.myLocationLabel}>Use my current location</Text>
                  <Text style={styles.myLocationSub}>
                    {locating ? 'Finding you on the map\u2026' : 'GPS\u00a0\u00b7 snaps to nearest stop'}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={Theme.colors.passenger} />
              </Pressable>

              {trimmedQuery && !hasExactMatch ? (
                <Pressable
                  onPress={() => commitPlace(trimmedQuery, { remember: true })}
                  style={({ pressed }) => [styles.useCustomRow, pressed && { opacity: 0.85 }]}>
                  <View style={styles.useCustomIcon}>
                    <Ionicons name="navigate" size={16} color="#FFFFFF" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.useCustomLabel} numberOfLines={1}>
                      Use “{trimmedQuery}”
                    </Text>
                    <Text style={styles.useCustomSub}>Set this as a custom location</Text>
                  </View>
                  <Ionicons name="arrow-forward" size={16} color={Theme.colors.passenger} />
                </Pressable>
              ) : null}

              <ScrollView
                style={styles.modalList}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}>

                {filteredSaved.length > 0 ? (
                  <>
                    <Text style={styles.modalSectionLabel}>SAVED PLACES</Text>
                    {filteredSaved.map((p) => (
                      <Pressable
                        key={`saved-${p.id}`}
                        onPress={() => commitPlace(p.name)}
                        style={({ pressed }) => [styles.placeRow, pressed && { opacity: 0.85 }]}>
                        <Ionicons
                          name={p.icon ?? 'bookmark-outline'}
                          size={18}
                          color={Theme.colors.passenger}
                        />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.placeText} numberOfLines={1}>{p.label}</Text>
                          <Text style={styles.placeSub} numberOfLines={1}>{p.name}</Text>
                        </View>
                      </Pressable>
                    ))}
                  </>
                ) : null}

                {filteredRecents.length > 0 ? (
                  <>
                    <Text style={styles.modalSectionLabel}>RECENT</Text>
                    {filteredRecents.map((name) => {
                      const selected = picker === 'from' ? name === fromPlace : name === toPlace;
                      return (
                        <Pressable
                          key={`recent-${name}`}
                          onPress={() => commitPlace(name, { remember: true })}
                          style={({ pressed }) => [
                            styles.placeRow,
                            selected && styles.placeRowSelected,
                            pressed && { opacity: 0.85 },
                          ]}>
                          <Ionicons
                            name="time-outline"
                            size={18}
                            color={selected ? Theme.colors.passenger : Theme.colors.textSub}
                          />
                          <Text style={[styles.placeText, selected && styles.placeTextSelected]}>
                            {name}
                          </Text>
                          {selected ? (
                            <Ionicons name="checkmark-circle" size={20} color={Theme.colors.passenger} />
                          ) : null}
                        </Pressable>
                      );
                    })}
                  </>
                ) : null}

                {filteredOptions.length > 0 ? (
                  <>
                    <Text style={styles.modalSectionLabel}>KUMASI STOPS</Text>
                    {filteredOptions.map((place) => {
                      const selected = picker === 'from' ? place === fromPlace : place === toPlace;
                      return (
                        <Pressable
                          key={place}
                          onPress={() => commitPlace(place)}
                          style={({ pressed }) => [
                            styles.placeRow,
                            selected && styles.placeRowSelected,
                            pressed && { opacity: 0.85 },
                          ]}>
                          <Ionicons
                            name="location-outline"
                            size={18}
                            color={selected ? Theme.colors.passenger : Theme.colors.textSub}
                          />
                          <Text style={[styles.placeText, selected && styles.placeTextSelected]}>
                            {place}
                          </Text>
                          {selected ? (
                            <Ionicons name="checkmark-circle" size={20} color={Theme.colors.passenger} />
                          ) : null}
                        </Pressable>
                      );
                    })}
                  </>
                ) : null}

                {!filteredSaved.length && !filteredRecents.length && !filteredOptions.length && !trimmedQuery ? (
                  <View style={styles.emptyHint}>
                    <Ionicons name="information-circle-outline" size={18} color={Theme.colors.textMuted} />
                    <Text style={styles.emptyHintText}>
                      No stops to show. Type any landmark above to use it.
                    </Text>
                  </View>
                ) : null}
              </ScrollView>
            </KeyboardAvoidingView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: SCREEN_GUTTER, marginBottom: 12 },
  card: {
    backgroundColor: Theme.colors.surface,
    borderRadius: Theme.radius.xl,
    borderWidth: 1,
    borderColor: Theme.colors.borderStrong,
    padding: 16,
    ...glowShadow(Theme.colors.passenger, 0.08),
  },
  routeVisual: { flexDirection: 'row', alignItems: 'stretch', gap: 12 },
  dotsCol: { alignItems: 'center', paddingTop: 18, width: 16 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  dotFrom: { backgroundColor: Theme.colors.success },
  dotTo: { backgroundColor: Theme.colors.passenger },
  line: { flex: 1, width: 2, backgroundColor: Theme.colors.border, marginVertical: 4, minHeight: 28 },
  fieldsCol: { flex: 1 },
  fieldRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 52, paddingVertical: 6 },
  fieldLabel: { color: Theme.colors.textMuted, fontSize: 11, fontWeight: '800', width: 40, letterSpacing: 0.5 },
  fieldValue: { flex: 1, color: Theme.colors.text, fontSize: 16, fontWeight: '700' },
  fieldPlaceholder: { color: Theme.colors.textMuted, fontWeight: '600' },
  fieldDisabled: { color: Theme.colors.textMuted, opacity: 0.6 },
  fieldDivider: { height: 1, backgroundColor: Theme.colors.border, marginLeft: 50 },
  swapBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Theme.colors.passengerSoft,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    borderWidth: 1,
    borderColor: Theme.colors.passenger + '44',
  },
  fareRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  fareText: { color: Theme.colors.success, fontSize: 13, fontWeight: '700' },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: Theme.colors.border,
  },
  durationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  durationText: { color: Theme.colors.passenger, fontSize: 13, fontWeight: '700' },

  quickSection: { marginTop: 16 },
  quickLabel: { color: Theme.colors.textMuted, fontSize: 11, fontWeight: '800', letterSpacing: 1, marginBottom: 10 },
  quickScroll: { gap: 10, paddingRight: 4 },
  quickChip: {
    backgroundColor: Theme.colors.glass,
    borderRadius: Theme.radius.md,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    maxWidth: 220,
  },
  quickChipTitle: { color: Theme.colors.text, fontSize: 12, fontWeight: '700', maxWidth: 80 },
  quickChipFare: { color: Theme.colors.passenger, fontSize: 11, fontWeight: '800', marginLeft: 4 },

  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: Theme.colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    maxHeight: '85%',
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Theme.colors.borderStrong,
    alignSelf: 'center',
    marginBottom: 12,
  },
  modalTitle: { color: Theme.colors.text, fontSize: 20, fontWeight: '900' },
  modalHint: { color: Theme.colors.textMuted, fontSize: 12, fontWeight: '600', marginTop: 4, marginBottom: 12 },

  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Theme.colors.glass,
    borderRadius: Theme.radius.md,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 12 : 8,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    color: Theme.colors.text,
    fontSize: 15,
    fontWeight: '600',
    paddingVertical: 0,
  },

  myLocationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Theme.colors.passengerSoft,
    borderRadius: Theme.radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Theme.colors.passenger + '55',
  },
  myLocationIcon: {
    width: 32, height: 32, borderRadius: 10,
    backgroundColor: Theme.colors.surface,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Theme.colors.passenger + '40',
  },
  myLocationLabel: { color: Theme.colors.text, fontSize: 14, fontWeight: '800' },
  myLocationSub: { color: Theme.colors.textSub, fontSize: 11, fontWeight: '600', marginTop: 2 },
  useCustomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Theme.colors.passenger,
    borderRadius: Theme.radius.md,
    padding: 12,
    marginBottom: 14,
    ...glowShadow(Theme.colors.passenger, 0.3),
  },
  useCustomIcon: {
    width: 32, height: 32, borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
  useCustomLabel: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  useCustomSub: { color: 'rgba(255,255,255,0.85)', fontSize: 11, fontWeight: '600', marginTop: 2 },

  modalSectionLabel: {
    color: Theme.colors.textMuted,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    marginTop: 6,
    marginBottom: 8,
  },
  modalList: { maxHeight: 460 },
  placeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: Theme.radius.md,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  placeRowSelected: {
    backgroundColor: Theme.colors.passengerSoft,
    borderColor: Theme.colors.passenger + '44',
  },
  placeText: { flex: 1, color: Theme.colors.text, fontSize: 15, fontWeight: '700' },
  placeSub: { color: Theme.colors.textSub, fontSize: 12, fontWeight: '500', marginTop: 2 },
  placeTextSelected: { color: Theme.colors.passenger, fontWeight: '800' },

  emptyHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 18,
  },
  emptyHintText: { flex: 1, color: Theme.colors.textMuted, fontSize: 13, fontWeight: '600' },
});
