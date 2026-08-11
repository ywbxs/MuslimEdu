import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * Shared between MainTabs.tsx's TabBar and every screen that sits inside
 * that Tab.Navigator - the bar is now a floating overlay (position:
 * 'absolute', matching the feed mockup's own .tab-bar-wrap treatment)
 * rather than a docked element, so nothing reserves space for it in the
 * navigator's own layout anymore. Every screen has to add this height as
 * its own bottom clearance, or its last bit of content ends up hidden
 * behind the bar.
 *
 * Computed, never measured - see MainTabs.tsx's TabBar for the full story
 * on why (an onLayout feeding back into this exact kind of height
 * calculation once caused an unbounded growth loop).
 */
export const TAB_BAR_ICON_SIZE = 24;
export const TAB_BAR_PADDING_TOP = 14;
export const TAB_BAR_PADDING_BOTTOM = 14;

/** The bar's actual rendered height, safe-area inset included. */
export function useTabBarHeight(): number {
  const insets = useSafeAreaInsets();
  const bottomInset = Math.max(insets.bottom, 8);
  return TAB_BAR_PADDING_TOP + TAB_BAR_ICON_SIZE + TAB_BAR_PADDING_BOTTOM + bottomInset;
}
