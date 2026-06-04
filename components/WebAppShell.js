import { Platform, useWindowDimensions, View } from 'react-native';

import { Theme } from '@/constants/theme';

/** Passenger-only web: marketing landing uses full width; booking app uses phone frame. */
export default function WebAppShell({ children, mode = 'app' }) {
  const { width } = useWindowDimensions();

  if (Platform.OS !== 'web') {
    return children;
  }

  if (mode === 'marketing') {
    return <View style={styles.marketingRoot}>{children}</View>;
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
  marketingRoot: {
    flex: 1,
    width: '100%',
    backgroundColor: Theme.colors.bg,
  },
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
