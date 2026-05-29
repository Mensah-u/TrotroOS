import { Ionicons } from '@expo/vector-icons';
import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';

import ProfileHeader from '@/components/ProfileHeader';
import { formatRoute, routes } from '@/constants/routes';
import { TAB_BAR_CLEARANCE } from '@/constants/layout';
import { Theme } from '@/constants/theme';
import { getFavoriteRoutes, toggleFavoriteRoute } from '@/services/favoriteRoutes';

export default function FavoriteRoutesScreen({ navigation }) {
  const [favs, setFavs] = useState([]);

  useFocusEffect(
    useCallback(() => {
      getFavoriteRoutes().then(setFavs);
    }, []),
  );

  const toggle = async (route) => {
    const next = await toggleFavoriteRoute(route.id, formatRoute(route));
    setFavs(next);
  };

  const isFav = (id) => favs.some((r) => r.routeId === id);

  const goFind = (route) => {
    Alert.alert(
      formatRoute(route),
      'Open Find Ride with this route preselected?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Open',
          onPress: () => {
            navigation.getParent()?.navigate('Find Ride', {
              prefillFrom: route.origin,
              prefillTo: route.destination,
            });
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ProfileHeader navigation={navigation} title="Favorite Routes" />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.intro}>
          Star the routes you ride most often. They'll appear here for quick access.
        </Text>

        {favs.length > 0 ? (
          <>
            <Text style={styles.sectionLabel}>YOUR FAVORITES</Text>
            <View style={styles.card}>
              {favs.map((f, idx) => {
                const matched = routes.find((r) => r.id === f.routeId);
                return (
                  <View key={f.routeId}>
                    <Pressable
                      onPress={() => matched && goFind(matched)}
                      style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}>
                      <View style={styles.starIconWrap}>
                        <Ionicons name="star" size={18} color={Theme.colors.gold} />
                      </View>
                      <View style={styles.rowText}>
                        <Text style={styles.rowLabel}>{f.label}</Text>
                        <Text style={styles.rowSub}>
                          Saved {new Date(f.savedAt).toLocaleDateString()}
                        </Text>
                      </View>
                      <Pressable onPress={() => matched && toggle(matched)} hitSlop={10} style={styles.removeBtn}>
                        <Ionicons name="close" size={16} color={Theme.colors.textSub} />
                      </Pressable>
                    </Pressable>
                    {idx < favs.length - 1 ? <View style={styles.divider} /> : null}
                  </View>
                );
              })}
            </View>
          </>
        ) : null}

        <Text style={styles.sectionLabel}>ALL KUMASI ROUTES</Text>
        <View style={styles.card}>
          {routes.map((route, idx) => (
            <View key={route.id}>
              <Pressable
                onPress={() => toggle(route)}
                style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}>
                <View style={[styles.starIconWrap, !isFav(route.id) && styles.starIconWrapOff]}>
                  <Ionicons
                    name={isFav(route.id) ? 'star' : 'star-outline'}
                    size={18}
                    color={isFav(route.id) ? Theme.colors.gold : Theme.colors.textMuted}
                  />
                </View>
                <View style={styles.rowText}>
                  <Text style={styles.rowLabel}>{formatRoute(route)}</Text>
                  <Text style={styles.rowSub}>GHS {route.fareGhs} per seat</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={Theme.colors.textMuted} />
              </Pressable>
              {idx < routes.length - 1 ? <View style={styles.divider} /> : null}
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Theme.colors.bgElevated },
  content: { padding: 20, paddingBottom: TAB_BAR_CLEARANCE },
  intro: { color: Theme.colors.textSub, fontSize: 14, lineHeight: 20, marginBottom: 16 },
  sectionLabel: {
    color: Theme.colors.textMuted, fontSize: 11, fontWeight: '700',
    letterSpacing: 1, marginBottom: 10, marginTop: 8,
  },
  card: {
    backgroundColor: Theme.colors.surface,
    borderRadius: Theme.radius.lg,
    borderWidth: 1, borderColor: Theme.colors.border,
    overflow: 'hidden', marginBottom: 16,
  },
  row: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
  starIconWrap: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: 'rgba(251,191,36,0.12)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(251,191,36,0.3)',
  },
  starIconWrapOff: {
    backgroundColor: Theme.colors.surfaceUp,
    borderColor: Theme.colors.border,
  },
  rowText: { flex: 1 },
  rowLabel: { color: Theme.colors.text, fontSize: 14, fontWeight: '600' },
  rowSub: { color: Theme.colors.textMuted, fontSize: 12, marginTop: 2 },
  removeBtn: { padding: 6 },
  divider: { height: 1, backgroundColor: Theme.colors.border, marginLeft: 60 },
});
