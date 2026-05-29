import { Ionicons } from '@expo/vector-icons';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';

import ProfileHeader from '@/components/ProfileHeader';
import { TAB_BAR_CLEARANCE } from '@/constants/layout';
import { Theme } from '@/constants/theme';
import { LANGUAGES, getAppPreferences, saveAppPreferences } from '@/services/appPreferences';
import { useI18n } from '@/context/I18nContext';

export default function LanguageScreen({ navigation }) {
  const { setLang: setI18nLang } = useI18n();
  const [language, setLanguage] = useState('en');
  const [haptics, setHaptics] = useState(true);
  const [dataSaver, setDataSaver] = useState(false);

  useFocusEffect(
    useCallback(() => {
      getAppPreferences().then((p) => {
        setLanguage(p.language);
        setHaptics(p.haptics);
        setDataSaver(p.dataSaver);
      });
    }, []),
  );

  const choose = async (code) => {
    setLanguage(code);
    await saveAppPreferences({ language: code });
    await setI18nLang(code);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ProfileHeader navigation={navigation} title="Language & App" />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.intro}>
          English and Twi cover core screens (Find Ride, waiting, sharing). More languages coming soon.
        </Text>

        <Text style={styles.sectionLabel}>APP LANGUAGE</Text>
        <View style={styles.card}>
          {LANGUAGES.map((lang, idx) => {
            const selected = language === lang.code;
            return (
              <View key={lang.code}>
                <Pressable
                  onPress={() => choose(lang.code)}
                  style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}>
                  <View style={[styles.radio, selected && styles.radioOn]}>
                    {selected ? <View style={styles.radioDot} /> : null}
                  </View>
                  <View style={styles.rowText}>
                    <Text style={styles.rowLabel}>{lang.label}</Text>
                    <Text style={styles.rowSub}>"{lang.greeting}"</Text>
                  </View>
                  {selected ? (
                    <Ionicons name="checkmark-circle" size={18} color={Theme.colors.success} />
                  ) : null}
                </Pressable>
                {idx < LANGUAGES.length - 1 ? <View style={styles.divider} /> : null}
              </View>
            );
          })}
        </View>

        <Text style={styles.sectionLabel}>APP BEHAVIOR</Text>
        <View style={styles.card}>
          <View style={styles.toggleRow}>
            <View style={styles.toggleIcon}>
              <Ionicons name="phone-portrait-outline" size={18} color={Theme.colors.textSub} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowLabel}>Vibration & haptics</Text>
              <Text style={styles.rowSub}>Subtle feedback on key actions</Text>
            </View>
            <Switch
              value={haptics}
              onValueChange={(v) => { setHaptics(v); saveAppPreferences({ haptics: v }); }}
              trackColor={{ false: '#333', true: 'rgba(243,111,33,0.5)' }}
              thumbColor={haptics ? Theme.colors.passenger : '#888'}
            />
          </View>
          <View style={styles.divider} />
          <View style={styles.toggleRow}>
            <View style={styles.toggleIcon}>
              <Ionicons name="cellular-outline" size={18} color={Theme.colors.textSub} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowLabel}>Data saver</Text>
              <Text style={styles.rowSub}>Reduce map refresh rate on slow networks</Text>
            </View>
            <Switch
              value={dataSaver}
              onValueChange={(v) => { setDataSaver(v); saveAppPreferences({ dataSaver: v }); }}
              trackColor={{ false: '#333', true: 'rgba(243,111,33,0.5)' }}
              thumbColor={dataSaver ? Theme.colors.passenger : '#888'}
            />
          </View>
        </View>

        <View style={styles.footnote}>
          <Ionicons name="information-circle-outline" size={16} color={Theme.colors.textMuted} />
          <Text style={styles.footnoteText}>
            Help us translate TrotroOS — use Profile → Send Feedback to contribute Twi, Ga, Ewe, or Pidgin strings.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Theme.colors.bgElevated },
  content: { padding: 20, paddingBottom: TAB_BAR_CLEARANCE },
  intro: { color: Theme.colors.textSub, fontSize: 14, lineHeight: 20, marginBottom: 16 },
  sectionLabel: { color: Theme.colors.textMuted, fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 10 },
  card: {
    backgroundColor: Theme.colors.surface,
    borderRadius: Theme.radius.lg,
    borderWidth: 1, borderColor: Theme.colors.border,
    overflow: 'hidden', marginBottom: 16,
  },
  row: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
  radio: {
    width: 20, height: 20, borderRadius: 10,
    borderWidth: 2, borderColor: Theme.colors.textMuted,
    alignItems: 'center', justifyContent: 'center',
  },
  radioOn: { borderColor: Theme.colors.passenger },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: Theme.colors.passenger },
  rowText: { flex: 1 },
  rowLabel: { color: Theme.colors.text, fontSize: 14, fontWeight: '600' },
  rowSub: { color: Theme.colors.textMuted, fontSize: 12, marginTop: 2, fontStyle: 'italic' },
  toggleRow: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
  toggleIcon: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: Theme.colors.surfaceUp,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Theme.colors.border,
  },
  divider: { height: 1, backgroundColor: Theme.colors.border, marginLeft: 64 },
  footnote: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, padding: 4 },
  footnoteText: { flex: 1, color: Theme.colors.textMuted, fontSize: 12, lineHeight: 18 },
});
