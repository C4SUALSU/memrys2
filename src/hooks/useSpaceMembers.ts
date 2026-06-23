import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import type { SpaceMember, SpaceMemberWithProfile } from '@/types/app';

export function useSpaceMembers(spaceId: string | undefined) {
  const { user } = useAuth();
  const [members, setMembers] = useState<SpaceMemberWithProfile[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMembers = useCallback(async () => {
    if (!spaceId) { setMembers([]); setLoading(false); return; }
    setLoading(true);

    const { data, error } = await supabase
      .from('space_members')
      .select('*, profiles:user_id(display_name, avatar_url)')
      .eq('space_id', spaceId);

    if (!error && data) {
      setMembers(
        data.map((row: Record<string, unknown>) => {
          const profile = row.profiles as { display_name?: string; avatar_url?: string | null } | null;
          return {
            id: row.id as string,
            space_id: row.space_id as string,
            user_id: row.user_id as string,
            joined_at: row.joined_at as string,
            relationship_tag: row.relationship_tag as string | undefined,
            display_name: profile?.display_name ?? 'Unknown',
            avatar_url: profile?.avatar_url ?? null,
          } as SpaceMemberWithProfile;
        })
      );
    }
    setLoading(false);
  }, [spaceId]);

  useEffect(() => { fetchMembers(); }, [fetchMembers]);

  const inviteUser = useCallback(async (userId: string) => {
    if (!spaceId) return { error: 'No space selected' };
    const { error } = await supabase
      .rpc('invite_user_to_space', { p_space_id: spaceId, p_target_user_id: userId });
    if (!error) await fetchMembers();
    return { error: error?.message ?? null };
  }, [spaceId, fetchMembers]);

  const kickMember = useCallback(async (userId: string) => {
    if (!spaceId) return { error: 'No space selected' };
    const { error } = await supabase
      .from('space_members')
      .delete()
      .eq('space_id', spaceId)
      .eq('user_id', userId);
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

  const updateMemberTag = useCallback(async (memberId: string, relationshipTag: string) => {
    if (!spaceId) return { error: 'No space selected' };
    const { error } = await supabase
      .from('space_members')
      .update({ relationship_tag: relationshipTag })
      .eq('id', memberId);
    if (!error) {
      setMembers((prev) =>
        prev.map((m) => (m.id === memberId ? { ...m, relationship_tag: relationshipTag } : m))
      );
    }
    return { error: error?.message ?? null };
  }, [spaceId]);

  const isMember = useCallback((userId: string) => {
    return members.some((m) => m.user_id === userId);
  }, [members]);

  const isOwner = useCallback(async () => {
    if (!spaceId || !user) return false;
    const { data } = await supabase
      .from('spaces')
      .select('created_by')
      .eq('id', spaceId)
      .single();
    return data?.created_by === user.id;
  }, [spaceId, user]);

  return {
    members, loading, fetchMembers, inviteUser, kickMember, leaveSpace,
    updateMemberTag, isMember, isOwner,
  };
}
