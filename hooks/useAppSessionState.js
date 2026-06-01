import { useCallback, useEffect, useState } from 'react';
import { Platform } from 'react-native';

import { getOrCreateDeviceId } from '@/services/passengerProfile';
import {
  clearAppRole,
  getAppRole,
  isPassengerOnboarded,
  ROLES,
  setAppRole,
  setPassengerOnboarded,
} from '@/services/appRole';
import { subscribeToAuthUrls } from '@/services/authDeepLink';
import { getMateSession, signOutMate, supabase } from '@/services/supabase';

const BOOTSTRAP_MAX_MS = 4000;

async function runBootstrap() {
  let savedRole = await getAppRole();
  if (Platform.OS === 'web' && savedRole === ROLES.MATE) {
    await setAppRole(ROLES.PASSENGER);
    savedRole = ROLES.PASSENGER;
  }
  if (!savedRole) {
    return { role: null, phase: 'welcome' };
  }

  if (savedRole === ROLES.MATE) {
    const { data } = await getMateSession();
    return {
      role: ROLES.MATE,
      phase: data?.session?.user ? 'app' : 'auth',
    };
  }

  const onboarded = await isPassengerOnboarded();
  return {
    role: savedRole,
    phase: onboarded ? 'app' : 'auth',
  };
}

export function useAppSessionState() {
  const [phase, setPhase] = useState('loading');
  const [role, setRole] = useState(null);

  const bootstrap = useCallback(async () => {
    try {
      const result = await Promise.race([
        runBootstrap(),
        new Promise((resolve) => {
          setTimeout(() => resolve({ role: null, phase: 'welcome', timedOut: true }), BOOTSTRAP_MAX_MS);
        }),
      ]);
      setRole(result.role);
      setPhase(result.phase);
      if (result.timedOut) {
        console.warn('[TrotroOS] Session bootstrap timed out — showing welcome screen.');
      }
    } catch (err) {
      console.warn('[TrotroOS] Session bootstrap failed:', err?.message ?? err);
      setRole(null);
      setPhase('welcome');
    }
  }, []);

  useEffect(() => {
    getOrCreateDeviceId().catch(() => {});
  }, []);

  useEffect(() => {
    bootstrap();

    const timeout = setTimeout(() => {
      setPhase((current) => (current === 'loading' ? 'welcome' : current));
    }, BOOTSTRAP_MAX_MS + 500);

    const advanceMateIfSignedIn = async () => {
      const savedRole = await getAppRole();
      if (savedRole !== ROLES.MATE) return;
      const { data } = await getMateSession();
      if (data?.session?.user) {
        setRole(ROLES.MATE);
        setPhase('app');
      }
    };

    const unsubLink = subscribeToAuthUrls(advanceMateIfSignedIn);

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        advanceMateIfSignedIn();
      }
      if (event === 'SIGNED_OUT') {
        getAppRole().then((savedRole) => {
          if (savedRole === ROLES.MATE) setPhase('auth');
        });
      }
    });

    return () => {
      clearTimeout(timeout);
      unsubLink();
      authListener.subscription.unsubscribe();
    };
  }, [bootstrap]);

  const selectRole = useCallback(async (nextRole) => {
    await setAppRole(nextRole);
    setRole(nextRole);
    setPhase('auth');
  }, []);

  const completeAuth = useCallback(async () => {
    if (role === ROLES.PASSENGER) {
      await setPassengerOnboarded(true);
      setPhase('app');
      return;
    }
    if (role === ROLES.MATE) {
      const { data } = await getMateSession();
      if (data?.session?.user) {
        setPhase('app');
        return;
      }
      setPhase('auth');
      return;
    }
    setPhase('app');
  }, [role]);

  const switchRole = useCallback(async () => {
    if (role === ROLES.MATE) {
      await signOutMate().catch(() => {});
    }
    await clearAppRole();
    setRole(null);
    setPhase('welcome');
  }, [role]);

  return {
    phase,
    role,
    selectRole,
    completeAuth,
    switchRole,
    refreshSession: bootstrap,
  };
}
