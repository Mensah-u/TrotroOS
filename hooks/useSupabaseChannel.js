import { useEffect } from 'react';

import { supabase } from '@/services/supabase';

/**
 * Lifecycle-safe Supabase realtime subscription.
 *
 *   useSupabaseChannel(
 *     () => subscribeToDriverLocations(setDrivers, { center, radiusKm: 2 }),
 *     [bboxKey],         // re-subscribe when bbox key changes
 *     { enabled: !!coords },
 *   );
 *
 * Guarantees:
 *  • Exactly one active channel per dependency snapshot.
 *  • Previous channel is removed before a new factory call (no orphans).
 *  • Unmount always removes the channel — even when factory returns null
 *    (e.g. while waiting for permission or coords).
 *
 * `factory` must return a Supabase Realtime channel (or null/undefined).
 */
export default function useSupabaseChannel(factory, deps = [], options = {}) {
  const { enabled = true } = options;

  useEffect(() => {
    if (!enabled) return undefined;
    let channel = null;
    try {
      channel = factory();
    } catch (e) {
      console.warn('[useSupabaseChannel] factory threw:', e?.message ?? e);
      return undefined;
    }
    if (!channel) return undefined;

    return () => {
      try {
        supabase.removeChannel(channel);
      } catch (e) {
        console.warn('[useSupabaseChannel] cleanup failed:', e?.message ?? e);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, enabled]);
}
