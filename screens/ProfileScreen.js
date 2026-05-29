import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useMemo, useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';

import PremiumBackground from '@/components/PremiumBackground';
import ProfileMenuList from '@/components/ProfileMenuList';
import { useAppSession } from '@/context/AppSessionContext';
import {
  APP_NAME,
  APP_VERSION,
  SUPPORT_PHONE,
  SUPPORT_PHONE_DISPLAY,
} from '@/constants/appInfo';
import { SCREEN_GUTTER, TAB_BAR_CLEARANCE } from '@/constants/layout';
import { Theme } from '@/constants/theme';
import { getOrCreateDeviceId, getPassengerProfile } from '@/services/passengerProfile';
import { getActiveReservation, getPassengerHistory, getPassengerRatings } from '@/services/supabase';

export default function ProfileScreen({ navigation }) {
  const { switchRole } = useAppSession();
  const [displayName, setDisplayName] = useState('Passenger');
  const [tripCount, setTripCount] = useState('—');
  const [avgRating, setAvgRating] = useState('—');
  const [rideStatus, setRideStatus] = useState('Ready');
  const [activeRide, setActiveRide] = useState(null);

  useFocusEffect(
    useCallback(() => {
      (async () => {
        const profile = await getPassengerProfile();
        setDisplayName(profile.displayName);

        const deviceId = await getOrCreateDeviceId();
        if (!deviceId) return;

        const [{ data: rides }, { data: ratings }, { data: activeRes }] = await Promise.all([
          getPassengerHistory(deviceId),
          getPassengerRatings(deviceId),
          getActiveReservation(deviceId),
        ]);

        setTripCount(String(rides?.length ?? 0));
        setRideStatus(activeRes ? 'Reserved' : 'Ready');
        if (activeRes?.trips) {
          const t = activeRes.trips;
          const mate = t.mate_profiles ?? {};
          setActiveRide({
            origin: t.origin,
            destination: t.destination,
            mateName: mate.full_name ?? 'Your mate',
            plate: mate.vehicle_registration ?? null,
          });
        } else {
          setActiveRide(null);
        }
        if (ratings?.length) {
          const avg = ratings.reduce((s, r) => s + r.stars, 0) / ratings.length;
          setAvgRating(avg.toFixed(1));
        } else {
          setAvgRating('—');
        }
      })();
    }, []),
  );

  const MENU_SECTIONS = useMemo(() => [
    {
      section: 'Quick access',
      items: [
        {
          icon: 'bookmark-outline',
          label: 'Saved Places',
          sub: 'Home, work, and shortcuts',
          onPress: () => navigation.navigate('SavedPlaces'),
        },
        {
          icon: 'star-outline',
          label: 'Favorite Routes',
          sub: 'Star routes for one-tap booking',
          onPress: () => navigation.navigate('FavoriteRoutes'),
        },
      ],
    },
    {
      section: 'Trips',
      items: [
        {
          icon: 'time-outline',
          label: 'Trip History',
          sub: 'Past rides and reservations',
          onPress: () => navigation.navigate('TripHistory'),
        },
        {
          icon: 'star-half-outline',
          label: 'My Ratings',
          sub: 'Trips you rated',
          onPress: () => navigation.navigate('MyRatings'),
        },
      ],
    },
    {
      section: 'Account',
      items: [
        {
          icon: 'person-outline',
          label: 'Edit Profile',
          sub: 'Name and contact info',
          onPress: () => navigation.navigate('EditProfile'),
        },
        {
          icon: 'notifications-outline',
          label: 'Notifications',
          sub: 'Alerts and reminders',
          onPress: () => navigation.navigate('Notifications'),
        },
        {
          icon: 'shield-checkmark-outline',
          label: 'Privacy',
          sub: 'Location and data sharing',
          onPress: () => navigation.navigate('Privacy'),
        },
        {
          icon: 'document-lock-outline',
          label: 'Data & privacy',
          sub: 'Export, clear cache, request deletion',
          onPress: () => navigation.navigate('DataPrivacy'),
        },
        {
          icon: 'language-outline',
          label: 'Language & App',
          sub: 'Greeting, haptics, data saver',
          onPress: () => navigation.navigate('Language'),
        },
        {
          icon: 'swap-horizontal-outline',
          label: 'Switch to Mate',
          sub: 'Drive and earn with TrotroOS',
          onPress: () => {
            Alert.alert('Switch to Mate?', 'You will sign out of the passenger app and choose Mate sign in.', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Switch', onPress: () => switchRole() },
            ]);
          },
        },
      ],
    },
    {
      section: 'Safety',
      items: [
        {
          icon: 'medkit-outline',
          label: 'Emergency Contact',
          sub: 'One-tap call to your trusted person',
          onPress: () => navigation.navigate('EmergencyContact'),
        },
        {
          icon: 'shield-outline',
          label: 'Safety tips',
          sub: 'Travel safely in Kumasi',
          onPress: () => navigation.navigate('Safety'),
        },
      ],
    },
    {
      section: 'Community',
      items: [
        {
          icon: 'gift-outline',
          label: 'Invite Friends',
          sub: 'Share TrotroOS and your invite code',
          onPress: () => navigation.navigate('InviteFriends'),
        },
      ],
    },
    {
      section: 'Support',
      items: [
        {
          icon: 'help-circle-outline',
          label: 'Help & FAQ',
          sub: 'Reservations, fares, and maps',
          onPress: () => navigation.navigate('Support', { section: 'faq' }),
        },
        {
          icon: 'call-outline',
          label: 'Contact Support',
          sub: SUPPORT_PHONE_DISPLAY,
          highlightSub: true,
          onPress: () => Linking.openURL(`tel:${SUPPORT_PHONE}`).catch(() => navigation.navigate('Support', { section: 'contact' })),
        },
        {
          icon: 'chatbox-ellipses-outline',
          label: 'Send Feedback',
          sub: 'Report bugs or suggest features',
          onPress: () => navigation.navigate('Feedback'),
        },
      ],
    },
    {
      section: 'Legal & app',
      items: [
        {
          icon: 'document-text-outline',
          label: 'Terms of Service',
          sub: 'Rules for using TrotroOS',
          onPress: () => navigation.navigate('Terms'),
        },
        {
          icon: 'shield-outline',
          label: 'Privacy Policy',
          sub: 'How we handle your data',
          onPress: () => navigation.navigate('PrivacyPolicy'),
        },
        {
          icon: 'pulse-outline',
          label: 'App Diagnostics',
          sub: 'Connection, cache, and build info',
          onPress: () => navigation.navigate('AppDiagnostics'),
        },
        {
          icon: 'information-circle-outline',
          label: 'About TrotroOS',
          sub: `Version ${APP_VERSION}`,
          onPress: () => navigation.navigate('About'),
        },
      ],
    },
  ], [navigation, switchRole]);

  return (
    <PremiumBackground variant="passenger">
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <LinearGradient colors={Theme.gradients.passengerHero} style={styles.profileHero}>
            <View style={styles.avatarRing}>
              <LinearGradient colors={Theme.gradients.buttonPassenger} style={styles.avatarGradient}>
                <Ionicons name="person" size={36} color="#FFFFFF" />
              </LinearGradient>
            </View>
            <Text style={styles.heroName}>{displayName}</Text>
            <Text style={styles.heroSub}>Passenger · Kumasi</Text>

            <View style={styles.heroStats}>
              {[
                { value: tripCount, label: 'Trips' },
                { value: avgRating, label: 'Given' },
                { value: rideStatus, label: 'Status' },
              ].map((s, i) => (
                <View key={s.label} style={[styles.heroStat, i > 0 && styles.heroStatBorder]}>
                  <Text style={styles.heroStatValue}>{s.value}</Text>
                  <Text style={styles.heroStatLabel}>{s.label}</Text>
                </View>
              ))}
            </View>
          </LinearGradient>

          {activeRide ? (
            <Pressable
              onPress={() => navigation.getParent()?.navigate('Find Ride', { openRideDetails: true })}
              style={({ pressed }) => [styles.activeRideCard, pressed && { opacity: 0.9 }]}>
              <LinearGradient colors={Theme.gradients.passengerHero} style={styles.activeRideGradient}>
                <View style={styles.activeRideTop}>
                  <View style={styles.activeRideBadge}>
                    <View style={styles.activeRideDot} />
                    <Text style={styles.activeRideBadgeText}>ACTIVE RIDE</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={Theme.colors.passenger} />
                </View>
                <Text style={styles.activeRideRoute}>
                  {activeRide.origin} → {activeRide.destination}
                </Text>
                <Text style={styles.activeRideMeta} numberOfLines={1}>
                  {activeRide.plate ? `${activeRide.plate} · ` : ''}{activeRide.mateName}
                </Text>
                <Text style={styles.activeRideHint}>Tap to view full ride details</Text>
              </LinearGradient>
            </Pressable>
          ) : null}

          <ProfileMenuList sections={MENU_SECTIONS} accent={Theme.colors.passenger} />

          <View style={styles.footer}>
            <Ionicons name="bus" size={18} color={Theme.colors.textMuted} />
            <Text style={styles.footerText}>{APP_NAME} · Connecting Kumasi</Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </PremiumBackground>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: 'transparent' },
  scrollContent: { paddingBottom: TAB_BAR_CLEARANCE },
  profileHero: { alignItems: 'center', paddingTop: 28, paddingBottom: 28, paddingHorizontal: SCREEN_GUTTER, marginBottom: 8 },
  avatarRing: { width: 92, height: 92, borderRadius: 30, padding: 3, marginBottom: 14 },
  avatarGradient: { flex: 1, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  heroName: { color: Theme.colors.text, fontSize: 24, fontWeight: '900', letterSpacing: -0.4 },
  heroSub: { color: Theme.colors.textMuted, fontSize: 14, marginTop: 4, fontWeight: '600' },
  heroStats: {
    flexDirection: 'row',
    marginTop: 24,
    backgroundColor: Theme.colors.glass,
    borderRadius: Theme.radius.lg,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    overflow: 'hidden',
    width: '100%',
  },
  heroStat: { flex: 1, alignItems: 'center', paddingVertical: 16 },
  heroStatBorder: { borderLeftWidth: 1, borderLeftColor: Theme.colors.border },
  heroStatValue: { color: Theme.colors.text, fontSize: 20, fontWeight: '900' },
  heroStatLabel: { color: Theme.colors.textMuted, fontSize: 12, fontWeight: '600', marginTop: 2 },
  activeRideCard: {
    marginHorizontal: SCREEN_GUTTER,
    marginBottom: 12,
    borderRadius: Theme.radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Theme.colors.passenger + '44',
  },
  activeRideGradient: { padding: 18 },
  activeRideTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  activeRideBadge: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  activeRideDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: Theme.colors.success },
  activeRideBadgeText: { color: Theme.colors.success, fontSize: 11, fontWeight: '800', letterSpacing: 0.8 },
  activeRideRoute: { color: Theme.colors.text, fontSize: 18, fontWeight: '900', letterSpacing: -0.3 },
  activeRideMeta: { color: Theme.colors.textSub, fontSize: 13, fontWeight: '600', marginTop: 6 },
  activeRideHint: { color: Theme.colors.passenger, fontSize: 12, fontWeight: '700', marginTop: 10 },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingTop: 32, paddingBottom: 8 },
  footerText: { color: Theme.colors.textMuted, fontSize: 13, fontWeight: '600' },
});
