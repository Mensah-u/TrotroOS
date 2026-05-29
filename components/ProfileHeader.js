import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

const C = {
  BG:     '#121212',
  SURFACE:'#1E1E1E',
  BORDER: 'rgba(255,255,255,0.07)',
  TEXT:   '#FFFFFF',
};

export default function ProfileHeader({ navigation, title }) {
  return (
    <View style={styles.header}>
      <Pressable onPress={() => navigation.goBack()} hitSlop={12} style={styles.backBtn}>
        <Ionicons name="chevron-back" size={20} color={C.TEXT} />
      </Pressable>
      <Text style={styles.title}>{title}</Text>
      <View style={{ width: 36 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  header:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.BORDER },
  backBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: C.SURFACE, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.BORDER },
  title:   { color: C.TEXT, fontSize: 18, fontWeight: '800' },
});
