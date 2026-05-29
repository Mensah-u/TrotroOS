import { Ionicons } from '@expo/vector-icons';
import { useCallback, useState } from 'react';
import {
  Alert,
  Linking,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';

import ProfileHeader from '@/components/ProfileHeader';
import { useAppSession } from '@/context/AppSessionContext';
import { SUPPORT_EMAIL } from '@/constants/appInfo';
import { SCREEN_GUTTER, TAB_BAR_CLEARANCE } from '@/constants/layout';
import { Theme } from '@/constants/theme';
import { ROLES } from '@/services/appRole';
import {
  exportPassengerLocalData,
  clearPassengerLocalCache,
  getOrCreateDeviceId,
} from '@/services/passengerProfile';
import { signOutMate } from '@/services/supabase';

function ActionRow({ icon, title, subtitle, onPress, danger }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && { opacity: 0.85 }]}>
      <View style={[styles.rowIcon, danger && styles.rowIconDanger]}>
        <Ionicons name={icon} size={20} color={danger ? Theme.colors.danger : Theme.colors.textSub} />
      </View>
      <View style={styles.rowText}>
        <Text style={[styles.rowLabel, danger && styles.rowLabelDanger]}>{title}</Text>
        <Text style={styles.rowSub}>{subtitle}</Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={Theme.colors.textMuted} />
    </Pressable>
  );
}

export default function DataPrivacyScreen({ navigation }) {
  const { role, switchRole } = useAppSession();
  const [deviceId, setDeviceId] = useState(null);

  useFocusEffect(
    useCallback(() => {
      getOrCreateDeviceId().then(setDeviceId).catch(() => {});
    }, []),
  );

  const handleExport = async () => {
    try {
      const payload = await exportPassengerLocalData();
      await Share.share({
        message: JSON.stringify(payload, null, 2),
        title: 'TrotroOS — my data export',
      });
    } catch (err) {
      Alert.alert('Export failed', err?.message ?? 'Could not export data.');
    }
  };

  const handleClearCache = () => {
    Alert.alert(
      'Clear local cache?',
      'Removes saved reservation cache and recent UI state on this device. Your trip history on the server is not deleted.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            await clearPassengerLocalCache();
            Alert.alert('Done', 'Local cache cleared.');
          },
        },
      ],
    );
  };

  const handleRequestDeletion = () => {
    const subject = encodeURIComponent('TrotroOS — data deletion request');
    const body = encodeURIComponent(
      `Please delete my TrotroOS data.\n\nDevice ID: ${deviceId ?? 'unknown'}\nRole: ${role ?? 'passenger'}\n\nThank you.`,
    );
    Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`).catch(() => {
      Alert.alert('Email us', `Send your request to ${SUPPORT_EMAIL}`);
    });
  };

  const handleMateSignOut = () => {
    Alert.alert(
      'Sign out of Mate account?',
      'You will return to role selection. To delete your mate account permanently, email support from the next screen.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign out',
          style: 'destructive',
          onPress: async () => {
            await signOutMate().catch(() => {});
            await switchRole();
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ProfileHeader navigation={navigation} title="Data & privacy" />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.intro}>
          Export what is stored on this device, clear local cache, or request deletion of server-side data.
        </Text>

        <View style={styles.card}>
          <ActionRow
            icon="download-outline"
            title="Export my data"
            subtitle="Share a JSON snapshot of local profile and device ID"
            onPress={handleExport}
          />
          <View style={styles.divider} />
          <ActionRow
            icon="trash-outline"
            title="Clear local cache"
            subtitle="Reservation cache and temporary app data on this phone"
            onPress={handleClearCache}
          />
          <View style={styles.divider} />
          <ActionRow
            icon="mail-outline"
            title="Request data deletion"
            subtitle={`Email ${SUPPORT_EMAIL} — processed within 7 days`}
            onPress={handleRequestDeletion}
            danger
          />
        </View>

        {role === ROLES.MATE ? (
          <View style={styles.card}>
            <ActionRow
              icon="log-out-outline"
              title="Sign out (Mate)"
              subtitle="Leave mate mode; contact support to fully delete auth account"
              onPress={handleMateSignOut}
              danger
            />
          </View>
        ) : null}

        <Pressable onPress={() => navigation.navigate('PrivacyPolicy')} style={styles.policyLink}>
          <Text style={styles.policyLinkText}>Read Privacy Policy</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Theme.colors.bg },
  content: { paddingHorizontal: SCREEN_GUTTER, paddingBottom: TAB_BAR_CLEARANCE },
  intro: { color: Theme.colors.textSub, fontSize: 14, lineHeight: 20, marginBottom: 16 },
  card: {
    backgroundColor: Theme.colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    overflow: 'hidden',
    marginBottom: 16,
  },
  row: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: Theme.colors.surfaceUp,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Theme.colors.border,
  },
  rowIconDanger: { backgroundColor: 'rgba(239,68,68,0.1)', borderColor: 'rgba(239,68,68,0.25)' },
  rowText: { flex: 1 },
  rowLabel: { color: Theme.colors.text, fontSize: 15, fontWeight: '700' },
  rowLabelDanger: { color: Theme.colors.danger },
  rowSub: { color: Theme.colors.textMuted, fontSize: 12, marginTop: 2, lineHeight: 17 },
  divider: { height: 1, backgroundColor: Theme.colors.border, marginLeft: 64 },
  policyLink: { alignItems: 'center', paddingVertical: 12 },
  policyLinkText: { color: Theme.colors.passenger, fontSize: 14, fontWeight: '700' },
});
