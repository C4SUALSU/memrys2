import { useCallback, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';

export function useProfile() {
  const { profile, refreshProfile } = useAuth();
  const [saving, setSaving] = useState(false);

  const updateProfile = useCallback(async (data: { display_name?: string; timezone?: string }) => {
    if (!profile) return { error: 'Not authenticated' };
    setSaving(true);
    const { error } = await supabase
      .from('profiles')
      .update(data)
      .eq('id', profile.id);
    setSaving(false);
    if (!error) await refreshProfile();
    return { error: error?.message ?? null };
  }, [profile, refreshProfile]);

  return { profile, saving, updateProfile, refreshProfile };
}
