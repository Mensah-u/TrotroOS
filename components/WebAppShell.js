import { Platform, useWindowDimensions, View } from 'react-native';

import { Theme } from '@/constants/theme';

/** Centers the mobile UI on wide desktop browsers. */
export default function WebAppShell({ children }) {
  const { width } = useWindowDimensions();

  if (Platform.OS !== 'web') {
    return children;
  }

  const maxWidth = width >= 900 ? 520 : width >= 600 ? 480 : '100%';

  return (
    <View style={styles.root}>
      <View style={[styles.frame, { maxWidth }]}>
        {children}
      </View>
    </View>
  );
}

const styles = {
  root: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: Theme.colors.bg,
    width: '100%',
  },
  frame: {
    flex: 1,
    width: '100%',
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 24,
  },
};
