import 'react-native-gesture-handler';

import { Ionicons } from '@expo/vector-icons';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import * as Linking from 'expo-linking';
import { useEffect } from 'react';
import { Platform, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import BrandedLoader from './components/BrandedLoader';
import { I18nProvider } from './context/I18nContext';
import { loadStaticData, refreshStaticData } from './services/staticData';
import { recordEvent, recordError, initMonitoring } from './services/monitoring';
import { parseAppDeepLink } from './services/shareLinks';
import { setPendingRidePrefill } from './services/deepLinkStore';
import { flushOfflineQueue } from './services/offlineQueue';
import { upsertPassengerLocation } from './services/supabase';
import ErrorBoundary from './components/ErrorBoundary';
import { AppSessionContext, useAppSession } from './context/AppSessionContext';
import { useAppSessionState } from './hooks/useAppSessionState';
import { TAB_BAR_CLEARANCE } from './constants/layout';
import { Theme, glowShadow } from './constants/theme';
import MateAuthScreen from './screens/auth/MateAuthScreen';
import FindRideScreen from './screens/FindRideScreen';
import MateScreen from './screens/MateScreen';
import MateAccountScreen from './screens/MateAccountScreen';
import MateProfileScreen from './screens/MateProfileScreen';
import PassengerAuthScreen from './screens/passenger/PassengerAuthScreen';
import ProfileScreen from './screens/ProfileScreen';
import TripHistoryScreen from './screens/TripHistoryScreen';
import WelcomeScreen from './screens/WelcomeScreen';
import EarnScreen from './screens/mate/EarnScreen';
import AboutScreen from './screens/profile/AboutScreen';
import AppDiagnosticsScreen from './screens/profile/AppDiagnosticsScreen';
import EditProfileScreen from './screens/profile/EditProfileScreen';
import EmergencyContactScreen from './screens/profile/EmergencyContactScreen';
import FavoriteRoutesScreen from './screens/profile/FavoriteRoutesScreen';
import FeedbackScreen from './screens/profile/FeedbackScreen';
import InviteFriendsScreen from './screens/profile/InviteFriendsScreen';
import LanguageScreen from './screens/profile/LanguageScreen';
import MateInsightsScreen from './screens/profile/MateInsightsScreen';
import MateNotificationsScreen from './screens/profile/MateNotificationsScreen';
import MatePrivacyScreen from './screens/profile/MatePrivacyScreen';
import MateVerificationScreen from './screens/profile/MateVerificationScreen';
import MyRatingsScreen from './screens/profile/MyRatingsScreen';
import NotificationsScreen from './screens/profile/NotificationsScreen';
import PrivacyScreen from './screens/profile/PrivacyScreen';
import DataPrivacyScreen from './screens/profile/DataPrivacyScreen';
import PrivacyPolicyScreen from './screens/profile/PrivacyPolicyScreen';
import SafetyScreen from './screens/profile/SafetyScreen';
import SafetyReportScreen from './screens/profile/SafetyReportScreen';
import ScheduledRideScreen from './screens/profile/ScheduledRideScreen';
import AdminDashboardScreen from './screens/profile/AdminDashboardScreen';
import SavedPlacesScreen from './screens/profile/SavedPlacesScreen';
import SupportScreen from './screens/profile/SupportScreen';
import TermsScreen from './screens/profile/TermsScreen';
import { ROLES } from './services/appRole';

SplashScreen.preventAutoHideAsync().catch(() => {});

const PassengerTab = createBottomTabNavigator();
const MateTab = createBottomTabNavigator();
const MateStack = createNativeStackNavigator();
const ProfileStack = createNativeStackNavigator();

const TAB_BOTTOM = TAB_BAR_CLEARANCE;

function floatingTabBar(accent) {
  return {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: Platform.OS === 'ios' ? 26 : 14,
    height: 68,
    borderRadius: 22,
    backgroundColor: 'rgba(18,18,18,0.94)',
    borderTopWidth: 0,
    borderWidth: 1,
    borderColor: Theme.colors.borderStrong,
    paddingBottom: 8,
    paddingTop: 8,
    ...glowShadow(accent, 0.12),
  };
}

function TabIcon({ focused, color, name, accent }) {
  return (
    <View style={{
      width: 44,
      height: 32,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 16,
      backgroundColor: focused ? accent + '28' : 'transparent',
    }}>
      <Ionicons name={name} size={focused ? 22 : 20} color={color} />
    </View>
  );
}

function MateDashboardStack() {
  return (
    <MateStack.Navigator screenOptions={{ headerShown: false }}>
      <MateStack.Screen name="MateHome" component={MateScreen} />
      <MateStack.Screen name="Earn" component={EarnScreen} />
    </MateStack.Navigator>
  );
}

function MateAccountStack() {
  return (
    <MateStack.Navigator screenOptions={{ headerShown: false }}>
      <MateStack.Screen name="MateAccountHome" component={MateAccountScreen} />
      <MateStack.Screen name="MateProfile" component={MateProfileScreen} />
      <MateStack.Screen name="TripHistory" component={TripHistoryScreen} />
      <MateStack.Screen name="MateNotifications" component={MateNotificationsScreen} />
      <MateStack.Screen name="MatePrivacy" component={MatePrivacyScreen} />
      <MateStack.Screen name="PrivacyPolicy" component={PrivacyPolicyScreen} />
      <MateStack.Screen name="DataPrivacy" component={DataPrivacyScreen} />
      <MateStack.Screen name="MateInsights" component={MateInsightsScreen} />
      <MateStack.Screen name="MateVerification" component={MateVerificationScreen} />
      <MateStack.Screen name="ScheduledRide" component={ScheduledRideScreen} />
      <MateStack.Screen name="SafetyReport" component={SafetyReportScreen} />
      <MateStack.Screen name="AdminDashboard" component={AdminDashboardScreen} />
      <MateStack.Screen name="EmergencyContact" component={EmergencyContactScreen} />
      <MateStack.Screen name="Language" component={LanguageScreen} />
      <MateStack.Screen name="InviteFriends" component={InviteFriendsScreen} />
      <MateStack.Screen name="AppDiagnostics" component={AppDiagnosticsScreen} />
      <MateStack.Screen name="Support" component={SupportScreen} />
      <MateStack.Screen name="Feedback" component={FeedbackScreen} />
      <MateStack.Screen name="Safety" component={SafetyScreen} />
      <MateStack.Screen name="Terms" component={TermsScreen} />
      <MateStack.Screen name="About" component={AboutScreen} />
    </MateStack.Navigator>
  );
}

function ProfileTabStack() {
  return (
    <ProfileStack.Navigator screenOptions={{ headerShown: false }}>
      <ProfileStack.Screen name="ProfileHome" component={ProfileScreen} />
      <ProfileStack.Screen name="TripHistory" component={TripHistoryScreen} />
      <ProfileStack.Screen name="MyRatings" component={MyRatingsScreen} />
      <ProfileStack.Screen name="EditProfile" component={EditProfileScreen} />
      <ProfileStack.Screen name="Notifications" component={NotificationsScreen} />
      <ProfileStack.Screen name="Privacy" component={PrivacyScreen} />
      <ProfileStack.Screen name="PrivacyPolicy" component={PrivacyPolicyScreen} />
      <ProfileStack.Screen name="DataPrivacy" component={DataPrivacyScreen} />
      <ProfileStack.Screen name="SavedPlaces" component={SavedPlacesScreen} />
      <ProfileStack.Screen name="FavoriteRoutes" component={FavoriteRoutesScreen} />
      <ProfileStack.Screen name="ScheduledRide" component={ScheduledRideScreen} />
      <ProfileStack.Screen name="EmergencyContact" component={EmergencyContactScreen} />
      <ProfileStack.Screen name="Language" component={LanguageScreen} />
      <ProfileStack.Screen name="InviteFriends" component={InviteFriendsScreen} />
      <ProfileStack.Screen name="AppDiagnostics" component={AppDiagnosticsScreen} />
      <ProfileStack.Screen name="Support" component={SupportScreen} />
      <ProfileStack.Screen name="Feedback" component={FeedbackScreen} />
      <ProfileStack.Screen name="Safety" component={SafetyScreen} />
      <ProfileStack.Screen name="SafetyReport" component={SafetyReportScreen} />
      <ProfileStack.Screen name="AdminDashboard" component={AdminDashboardScreen} />
      <ProfileStack.Screen name="Terms" component={TermsScreen} />
      <ProfileStack.Screen name="About" component={AboutScreen} />
    </ProfileStack.Navigator>
  );
}

function PassengerApp() {
  return (
    <PassengerTab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Theme.colors.passenger,
        tabBarInactiveTintColor: Theme.colors.textMuted,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '800', letterSpacing: 0.4 },
        tabBarStyle: floatingTabBar(Theme.colors.passenger),
        sceneContainerStyle: { paddingBottom: TAB_BOTTOM },
      }}>
      <PassengerTab.Screen
        name="Find Ride"
        component={FindRideScreen}
        options={{
          tabBarIcon: ({ focused, color }) => (
            <TabIcon focused={focused} color={color} name={focused ? 'search' : 'search-outline'} accent={Theme.colors.passenger} />
          ),
        }}
      />
      <PassengerTab.Screen
        name="Profile"
        component={ProfileTabStack}
        options={{
          tabBarIcon: ({ focused, color }) => (
            <TabIcon focused={focused} color={color} name={focused ? 'person' : 'person-outline'} accent={Theme.colors.passenger} />
          ),
        }}
      />
    </PassengerTab.Navigator>
  );
}

function MateApp() {
  return (
    <MateTab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Theme.colors.mate,
        tabBarInactiveTintColor: Theme.colors.textMuted,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '800', letterSpacing: 0.4 },
        tabBarStyle: floatingTabBar(Theme.colors.mate),
        sceneContainerStyle: { paddingBottom: TAB_BOTTOM },
      }}>
      <MateTab.Screen
        name="Dashboard"
        component={MateDashboardStack}
        options={{
          tabBarIcon: ({ focused, color }) => (
            <TabIcon focused={focused} color={color} name={focused ? 'speedometer' : 'speedometer-outline'} accent={Theme.colors.mate} />
          ),
        }}
      />
      <MateTab.Screen
        name="Trips"
        component={TripHistoryScreen}
        options={{
          tabBarIcon: ({ focused, color }) => (
            <TabIcon focused={focused} color={color} name={focused ? 'time' : 'time-outline'} accent={Theme.colors.mate} />
          ),
        }}
      />
      <MateTab.Screen
        name="Account"
        component={MateAccountStack}
        options={{
          tabBarIcon: ({ focused, color }) => (
            <TabIcon focused={focused} color={color} name={focused ? 'person' : 'person-outline'} accent={Theme.colors.mate} />
          ),
        }}
      />
    </MateTab.Navigator>
  );
}

function AppRoot() {
  const session = useAppSession();

  // Warm the offline-first static data cache (routes / places / fares).
  // Non-blocking — bundled snapshot is already available synchronously.
  useEffect(() => {
    initMonitoring();
    recordEvent('app_boot');
    loadStaticData().catch((e) => recordError(e, { where: 'loadStaticData' }));
    refreshStaticData().catch((e) => recordError(e, { where: 'refreshStaticData' }));
    flushOfflineQueue({
      passenger_location: async (payload) => {
        const { error } = await upsertPassengerLocation(
          payload.deviceId,
          payload.reservationId,
          payload.latitude,
          payload.longitude,
          payload.queuedRoute,
          payload.pickupStop,
        );
        return !error;
      },
    }).catch(() => {});

    const handleUrl = (url) => {
      const parsed = parseAppDeepLink(url);
      if (parsed?.type === 'ride' && (parsed.from || parsed.to)) {
        setPendingRidePrefill({ from: parsed.from, to: parsed.to, ref: parsed.ref });
      }
    };
    Linking.getInitialURL().then((url) => url && handleUrl(url)).catch(() => {});
    const sub = Linking.addEventListener('url', ({ url }) => handleUrl(url));
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (session.phase !== 'loading') {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [session.phase]);

  if (session.phase === 'loading') {
    return <BrandedLoader message="Starting TrotroOS" />;
  }

  if (session.phase === 'welcome') {
    return <WelcomeScreen onSelectRole={session.selectRole} />;
  }

  if (session.phase === 'auth' && session.role === ROLES.MATE) {
    return (
      <MateAuthScreen onSuccess={session.completeAuth} onBack={session.switchRole} />
    );
  }

  if (session.phase === 'auth' && session.role === ROLES.PASSENGER) {
    return (
      <PassengerAuthScreen onSuccess={session.completeAuth} onBack={session.switchRole} />
    );
  }

  if (session.phase === 'app' && session.role === ROLES.MATE) {
    return <MateApp />;
  }

  if (session.phase === 'app' && session.role === ROLES.PASSENGER) {
    return <PassengerApp />;
  }

  return <WelcomeScreen onSelectRole={session.selectRole} />;
}

export default function App() {
  const session = useAppSessionState();

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ErrorBoundary>
          <I18nProvider>
            <AppSessionContext.Provider value={session}>
              <NavigationContainer>
                <StatusBar style="light" />
                <AppRoot />
              </NavigationContainer>
            </AppSessionContext.Provider>
          </I18nProvider>
        </ErrorBoundary>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
