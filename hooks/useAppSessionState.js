import { useCallback, useEffect, useState } from 'react';

import {
  clearAppRole,
  getAppRole,
  isPassengerOnboarded,
  ROLES,
  setAppRole,
  setPassengerOnboarded,
} from '@/services/appRole';
import { subscribeToAuthUrls } from '@/services/authDeepLink';
import { getCurrentMate, getMateSession, signOutMate, supabase } from '@/services/supabase';

export function useAppSessionState() {
  const [phase, setPhase] = useState('loading');
  const [role, setRole] = useState(null);

  const bootstrap = useCallback(async () => {
    try {
      const savedRole = await getAppRole();
      if (!savedRole) {
        setRole(null);
        setPhase('welcome');
        return;
      }

      setRole(savedRole);

      if (savedRole === ROLES.MATE) {
        const { data } = await getCurrentMate();
        setPhase(data?.user ? 'app' : 'auth');
        return;
      }

      const onboarded = await isPassengerOnboarded();
      setPhase(onboarded ? 'app' : 'auth');
    } catch (err) {
      console.warn('[TrotroOS] Session bootstrap failed:', err?.message ?? err);
      setRole(null);
      setPhase('welcome');
    }
  }, []);

  useEffect(() => {
    bootstrap();

    const timeout = setTimeout(() => {
      setPhase((current) => (current === 'loading' ? 'welcome' : current));
    }, 8000);

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
