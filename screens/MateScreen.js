import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useEffect, useState } from 'react';

import BrandedLoader from '@/components/BrandedLoader';
import {
  ensureMateProfile,
  getCurrentMate,
  getMateProfile,
} from '@/services/supabase';
import Dashboard from './mate/Dashboard';

export default function MateScreen({ navigation }) {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);

  const loadProfile = useCallback(async () => {
    const { data: userData } = await getCurrentMate();
    if (!userData?.user) {
      setUser(null);
      setProfile(null);
      setLoading(false);
      return;
    }
    setUser(userData.user);
    let { data: profileData } = await getMateProfile(userData.user.id);
    if (!profileData) {
      await ensureMateProfile(userData.user);
      ({ data: profileData } = await getMateProfile(userData.user.id));
    }
    setProfile(profileData ?? null);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  useFocusEffect(
    useCallback(() => {
      if (user) {
        getMateProfile(user.id).then(({ data }) => {
          if (data) setProfile(data);
        });
      }
    }, [user]),
  );

  const openProfile = useCallback(() => {
    navigation.getParent()?.navigate('Account', {
      screen: 'MateAccountHome',
    });
  }, [navigation]);

  const openEarn = useCallback(() => {
    navigation.navigate('Earn');
  }, [navigation]);

  if (loading) {
    return <BrandedLoader message="Loading dashboard" />;
  }

  return (
    <Dashboard
      profile={profile}
      mateId={user?.id}
      onOpenProfile={openProfile}
      onOpenEarn={openEarn}
    />
  );
}
