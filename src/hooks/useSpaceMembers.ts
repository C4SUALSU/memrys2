import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { SpaceMember } from '@/types/app';

export function useSpaceMembers(spaceId: string | undefined) {
  const [members, setMembers] = useState<SpaceMember[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMembers = useCallback(async () => {
    if (!spaceId) { setMembers([]); setLoading(false); return; }
    setLoading(true);
    const { data, error } = await supabase
      .from('space_members')
      .select('*')
      .eq('space_id', spaceId);
    if (!error && data) setMembers(data);
    setLoading(false);
  }, [spaceId]);

  useEffect(() => { fetchMembers(); }, [fetchMembers]);

  const joinSpace = useCallback(async (userId: string) => {
    if (!spaceId) return { error: 'No space selected' };
    const { error } = await supabase
      .from('space_members')
      .insert({ space_id: spaceId, user_id: userId });
    if (!error) await fetchMembers();
    return { error: error?.message ?? null };
  }, [spaceId, fetchMembers]);

  const leaveSpace = useCallback(async (userId: string) => {
    if (!spaceId) return { error: 'No space selected' };
    const { error } = await supabase
      .from('space_members')
      .delete()
      .eq('space_id', spaceId)
      .eq('user_id', userId);
    if (!error) await fetchMembers();
    return { error: error?.message ?? null };
  }, [spaceId, fetchMembers]);

  const isMember = useCallback((userId: string) => {
    return members.some((m) => m.user_id === userId);
  }, [members]);

  return { members, loading, fetchMembers, joinSpace, leaveSpace, isMember };
}
