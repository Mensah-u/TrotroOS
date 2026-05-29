import { Ionicons } from '@expo/vector-icons';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';

import ProfileHeader from '@/components/ProfileHeader';
import { TAB_BAR_CLEARANCE } from '@/constants/layout';
import { Theme } from '@/constants/theme';
import { getMateSettings, saveMateSettings } from '@/services/mateSettings';

function ToggleRow({ icon, label, sub, value, onValueChange }) {
  return (
    <View style={styles.row}>
      <View style={styles.rowIcon}>
        <Ionicons name={icon} size={20} color={Theme.colors.textSub} />
      </View>
      <View style={styles.rowText}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={styles.rowSub}>{sub}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: '#333', true: 'rgba(249,115,22,0.5)' }}
        thumbColor={value ? Theme.colors.mate : '#888'}
      />
    </View>
  );
}

export default function MatePrivacyScreen({ navigation }) {
  const [shareLocation, setShareLocation] = useState(true);
  const [showPlate, setShowPlate] = useState(true);

  useFocusEffect(
    useCallback(() => {
      getMateSettings().then((s) => {
        setShareLocation(s.shareLocation);
        setShowPlate(s.showPlate);
      });
    }, []),
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ProfileHeader navigation={navigation} title="Privacy" />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.intro}>
          Control what passengers see while you have an active trip on the map.
        </Text>
        <View style={styles.card}>
          <ToggleRow
            icon="navigate-outline"
            label="Share live location"
            sub="Show your vehicle on the passenger map"
            value={shareLocation}
            onValueChange={(v) => { setShareLocation(v); saveMateSettings({ shareLocation: v }); }}
          />
          <View style={styles.divider} />
          <ToggleRow
            icon="card-outline"
            label="Show registration plate"
            sub="Display plate on trip cards and reservations"
            value={showPlate}
            onValueChange={(v) => { setShowPlate(v); saveMateSettings({ showPlate: v }); }}
          />
        </View>
        <Text style={styles.footnote}>
          Account data is stored securely with Supabase. See Terms of Service for full details.
        </Text>
      </ScrollView>
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
    borderWidth: 1,
    borderColor: Theme.colors.border,
    overflow: 'hidden',
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
  rowText: { flex: 1 },
  rowLabel: { color: Theme.colors.text, fontSize: 15, fontWeight: '600' },
  rowSub: { color: Theme.colors.textMuted, fontSize: 12, marginTop: 2 },
  divider: { height: 1, backgroundColor: Theme.colors.border, marginLeft: 64 },
  footnote: { color: Theme.colors.textMuted, fontSize: 12, lineHeight: 18, marginTop: 16 },
});
