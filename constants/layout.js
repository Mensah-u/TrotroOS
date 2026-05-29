import { Platform } from 'react-native';

/** Horizontal inset shared across passenger screens (cards, lists, headers). */
export const SCREEN_GUTTER = 20;

/** Floating tab bar geometry (matches App.js floatingTabBar). */
export const FLOATING_TAB_OFFSET = Platform.OS === 'ios' ? 26 : 14;
export const FLOATING_TAB_HEIGHT = 68;

/** Space so scroll content / lists clear the tab bar. */
export const TAB_BAR_CLEARANCE =
  FLOATING_TAB_OFFSET + FLOATING_TAB_HEIGHT + (Platform.OS === 'ios' ? 20 : 16);

/** Pinned primary CTAs (Start Trip, Depart Now, Reserve bar). */
export const TAB_FOOTER_CLEARANCE = TAB_BAR_CLEARANCE + 20;

/** Screens without bottom tabs (auth, welcome). */
export const SCREEN_SCROLL_BOTTOM = Platform.OS === 'ios' ? 40 : 32;

export function tabScrollPadding(extra = 0) {
  return TAB_BAR_CLEARANCE + extra;
}
