import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useState } from 'react';
import { Alert, Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
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
import { TAB_BAR_CLEARANCE } from '@/constants/layout';
import { Theme } from '@/constants/theme';
import {
  getCurrentMate,
  getMateProfile,
  getMateTripHistory,
} from '@/services/supabase';
import { computeVerificationLevel, getMateVerification } from '@/services/mateVerification';

export default function MateAccountScreen({ navigation }) {
  const { switchRole } = useAppSession();
  const [fullName, setFullName] = useState('Mate');
  const [vehiclePlate, setVehiclePlate] = useState('—');
  const [defaultRoute, setDefaultRoute] = useState('Any route');
  const [tripCount, setTripCount] = useState('—');
  const [activeTrips, setActiveTrips] = useState('0');
  const [profile, setProfile] = useState(null);
  const [verifyState, setVerifyState] = useState({});

  useFocusEffect(
    useCallback(() => {
      (async () => {
        const { data: userData } = await getCurrentMate();
        if (!userData?.user) return;
        const mateId = userData.user.id;
        const { data: prof } = await getMateProfile(mateId);
        if (prof) {
          setProfile(prof);
          setFullName(prof.full_name ?? 'Mate');
          setVehiclePlate(prof.vehicle_registration ?? '—');
          setDefaultRoute(prof.default_route ?? 'Any route');
        }
        const { data: trips } = await getMateTripHistory(mateId, 50);
        const list = trips ?? [];
        setTripCount(String(list.length));
        setActiveTrips(String(list.filter((t) => t.status === 'active' || t.status === 'full').length));
        const v = await getMateVerification();
        setVerifyState(v);
      })();
    }, []),
  );

  const verifySummary = computeVerificationLevel(verifyState);
  const verifyBadge =
    verifySummary.level === 'verified'
      ? { color: Theme.colors.success, icon: 'shield-checkmark' }
      : verifySummary.level === 'partial'
        ? { color: Theme.colors.gold, icon: 'shield-half' }
        : { color: Theme.colors.textMuted, icon: 'shield-outline' };

  const openEdit = () => {
    navigation.navigate('MateProfile', { profile });
  };

  const MENU_SECTIONS = [
    {
      section: 'Driving',
      items: [
        {
          icon: 'create-outline',
          label: 'Edit Profile',
          sub: 'Name, phone, vehicle, default route',
          onPress: openEdit,
        },
        {
          icon: 'time-outline',
          label: 'Trip History',
          sub: 'Completed and active trips',
          onPress: () => navigation.navigate('TripHistory'),
        },
        {
          icon: 'stats-chart-outline',
          label: 'Insights',
          sub: 'Weekly trips, earnings, top route',
          onPress: () => navigation.navigate('MateInsights'),
        },
        {
          icon: 'trending-up-outline',
          label: 'Earnings & demand',
          sub: 'Live earnings dashboard',
          onPress: () => navigation.getParent()?.navigate('Dashboard', { screen: 'Earn' }),
        },
        {
          icon: verifyBadge.icon,
          label: 'Verification',
          sub: verifySummary.label,
          highlightSub: verifySummary.level === 'verified',
          onPress: () => navigation.navigate('MateVerification'),
        },
      ],
    },
    {
      section: 'Preferences',
      items: [
        {
          icon: 'notifications-outline',
          label: 'Notifications',
          sub: 'Reservations and trip alerts',
          onPress: () => navigation.navigate('MateNotifications'),
        },
        {
          icon: 'shield-checkmark-outline',
          label: 'Privacy',
          sub: 'Location and plate visibility',
          onPress: () => navigation.navigate('MatePrivacy'),
        },
        {
          icon: 'language-outline',
          label: 'Language & App',
          sub: 'Greeting, haptics, data saver',
          onPress: () => navigation.navigate('Language'),
        },
        {
          icon: 'swap-horizontal-outline',
          label: 'Switch to Passenger',
          sub: 'Book a seat as a rider',
          onPress: () => {
            Alert.alert('Switch to Passenger?', 'You will sign out of the mate app.', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Switch', onPress: () => switchRole() },
            ]);
          },
        },
      ],
    },
    {
      section: 'Support',
      items: [
        {
          icon: 'help-circle-outline',
          label: 'Help & FAQ',
          sub: 'How trips and reservations work',
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
          sub: 'Ideas, bugs, route requests',
          onPress: () => navigation.navigate('Feedback'),
        },
        {
          icon: 'shield-outline',
          label: 'Safety',
          sub: 'Tips for mates and passengers',
          onPress: () => navigation.navigate('Safety'),
        },
        {
          icon: 'medkit-outline',
          label: 'Emergency Contact',
          sub: 'Person to alert in an emergency',
          onPress: () => navigation.navigate('EmergencyContact'),
        },
      ],
    },
    {
      section: 'Community',
      items: [
        {
          icon: 'gift-outline',
          label: 'Invite Friends & Mates',
          sub: 'Share TrotroOS with your network',
          onPress: () => navigation.navigate('InviteFriends'),
        },
      ],
    },
    {
      section: 'Legal & app',
      items: [
        {
          icon: 'document-text-outline',
          label: 'Terms of Service',
          sub: 'Usage rules for mates and riders',
          onPress: () => navigation.navigate('Terms'),
        },
        {
          icon: 'shield-outline',
          label: 'Privacy Policy',
          sub: 'How we handle your data',
          onPress: () => navigation.navigate('PrivacyPolicy'),
        },
        {
          icon: 'document-lock-outline',
          label: 'Data & privacy',
          sub: 'Export, clear cache, request deletion',
          onPress: () => navigation.navigate('DataPrivacy'),
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
    {
      section: 'Account',
      items: [
        {
          icon: 'log-out-outline',
          label: 'Sign Out',
          sub: 'Return to role selection',
          danger: true,
          onPress: () => {
            Alert.alert('Sign out?', 'You will need to sign in again as a mate.', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Sign Out', style: 'destructive', onPress: () => switchRole() },
            ]);
          },
        },
      ],
    },
  ];

  return (
    <PremiumBackground variant="mate">
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <LinearGradient colors={Theme.gradients.mateHero} style={styles.hero}>
            <View style={styles.avatarRing}>
              <LinearGradient colors={Theme.gradients.buttonMate} style={styles.avatar}>
                <Ionicons name="person" size={34} color="#FFFFFF" />
              </LinearGradient>
            </View>
            <View style={styles.heroNameRow}>
              <Text style={styles.heroName}>{fullName}</Text>
              <View style={[styles.verifyBadge, { backgroundColor: verifyBadge.color + '22', borderColor: verifyBadge.color + '55' }]}>
                <Ionicons name={verifyBadge.icon} size={12} color={verifyBadge.color} />
                <Text style={[styles.verifyBadgeText, { color: verifyBadge.color }]}>
                  {verifySummary.level === 'verified' ? 'Verified' : verifySummary.level === 'partial' ? `${verifySummary.done}/${verifySummary.total}` : 'Unverified'}
                </Text>
              </View>
            </View>
            <Text style={styles.heroSub}>Mate · {vehiclePlate}</Text>
            <Text style={styles.heroRoute} numberOfLines={1}>{defaultRoute}</Text>

            <View style={styles.stats}>
              {[
                { value: tripCount, label: 'Trips' },
                { value: activeTrips, label: 'Live' },
                { value: 'Mate', label: 'Role' },
              ].map((s, i) => (
                <View key={s.label} style={[styles.stat, i > 0 && styles.statBorder]}>
                  <Text style={styles.statValue}>{s.value}</Text>
                  <Text style={styles.statLabel}>{s.label}</Text>
                </View>
              ))}
            </View>
          </LinearGradient>

          <ProfileMenuList sections={MENU_SECTIONS} accent={Theme.colors.mate} />

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
  safe: { flex: 1, backgroundColor: 'transparent' },
  scroll: { paddingBottom: TAB_BAR_CLEARANCE },
  hero: { alignItems: 'center', paddingTop: 28, paddingBottom: 28, paddingHorizontal: 20, marginBottom: 4 },
  avatarRing: { width: 88, height: 88, borderRadius: 28, padding: 3, marginBottom: 12 },
  avatar: { flex: 1, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  heroNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap', justifyContent: 'center' },
  heroName: { color: Theme.colors.text, fontSize: 24, fontWeight: '900', letterSpacing: -0.4 },
  verifyBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: 10, borderWidth: 1,
  },
  verifyBadgeText: { fontSize: 11, fontWeight: '800', letterSpacing: 0.3 },
  heroSub: { color: Theme.colors.textSub, fontSize: 14, marginTop: 4, fontWeight: '600' },
  heroRoute: { color: Theme.colors.mate, fontSize: 13, marginTop: 6, fontWeight: '700', maxWidth: '90%' },
  stats: {
    flexDirection: 'row',
    marginTop: 22,
    backgroundColor: Theme.colors.glass,
    borderRadius: Theme.radius.lg,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    overflow: 'hidden',
    width: '100%',
  },
  stat: { flex: 1, alignItems: 'center', paddingVertical: 14 },
  statBorder: { borderLeftWidth: 1, borderLeftColor: Theme.colors.border },
  statValue: { color: Theme.colors.text, fontSize: 18, fontWeight: '900' },
  statLabel: { color: Theme.colors.textMuted, fontSize: 11, fontWeight: '600', marginTop: 2 },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingTop: 28, paddingBottom: 8 },
  footerText: { color: Theme.colors.textMuted, fontSize: 13, fontWeight: '600' },
});
