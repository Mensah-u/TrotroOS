import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { SCREEN_GUTTER } from '@/constants/layout';
import { Theme } from '@/constants/theme';

/**
 * @param {{ sections: Array<{ section: string, items: Array<{ icon: string, label: string, sub?: string, onPress: () => void, danger?: boolean }> }> }} props
 */
export default function ProfileMenuList({ sections, accent = Theme.colors.passenger }) {
  return sections.map((block) => (
    <View key={block.section} style={styles.section}>
      <Text style={styles.sectionLabel}>{block.section.toUpperCase()}</Text>
      <View style={styles.sectionCard}>
        {block.items.map((item, idx) => (
          <View key={item.label}>
            <Pressable
              onPress={item.onPress}
              style={({ pressed }) => [styles.menuRow, pressed && { opacity: 0.7 }]}>
              <View style={[styles.menuIcon, item.danger && styles.menuIconDanger]}>
                <Ionicons
                  name={item.icon}
                  size={20}
                  color={item.danger ? Theme.colors.danger : Theme.colors.textSub}
                />
              </View>
              <View style={styles.menuText}>
                <Text style={[styles.menuLabel, item.danger && styles.menuLabelDanger]}>
                  {item.label}
                </Text>
                {item.sub ? (
                  <Text
                    style={[
                      styles.menuSub,
                      item.highlightSub && { color: accent, fontWeight: '700' },
                    ]}>
                    {item.sub}
                  </Text>
                ) : null}
              </View>
              <Ionicons name="chevron-forward" size={16} color={Theme.colors.textMuted} />
            </Pressable>
            {idx < block.items.length - 1 ? <View style={styles.menuDivider} /> : null}
          </View>
        ))}
      </View>
    </View>
  ));
}

const styles = StyleSheet.create({
  section:      { paddingHorizontal: SCREEN_GUTTER, marginTop: 8 },
  sectionLabel: {
    color: Theme.colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 8,
    marginTop: 8,
    paddingHorizontal: 4,
  },
  sectionCard: {
    backgroundColor: Theme.colors.surface,
    borderRadius: Theme.radius.lg,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    overflow: 'hidden',
  },
  menuRow:     { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, gap: 14 },
  menuIcon:    {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: Theme.colors.surfaceUp,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Theme.colors.border,
  },
  menuIconDanger: { backgroundColor: 'rgba(239,68,68,0.08)', borderColor: 'rgba(239,68,68,0.25)' },
  menuText:    { flex: 1 },
  menuLabel:   { color: Theme.colors.text, fontSize: 15, fontWeight: '600' },
  menuLabelDanger: { color: Theme.colors.danger },
  menuSub:     { color: Theme.colors.textMuted, fontSize: 12, marginTop: 1 },
  menuDivider: { height: 1, backgroundColor: Theme.colors.border, marginLeft: 66 },
});
