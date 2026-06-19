import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import type { FriendConnection, FriendConnectionWithProfile, UserSearchResult } from '@/types/app';

export function useFriends() {
  const { user } = useAuth();
  const toast = useToast();
  const [friends, setFriends] = useState<FriendConnectionWithProfile[]>([]);
  const [pending, setPending] = useState<FriendConnectionWithProfile[]>([]);
  const [blocked, setBlocked] = useState<FriendConnectionWithProfile[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchConnections = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    setLoading(true);

    const { data, error } = await supabase
      .from('friend_connections')
      .select('*')
      .or(`requester_id.eq.${user.id},recipient_id.eq.${user.id}`) as { data: FriendConnection[] | null; error: Error | null };

    if (error || !data) { setLoading(false); return; }

    const enriched: FriendConnectionWithProfile[] = await Promise.all(
      data.map(async (conn) => {
        const otherId = conn.requester_id === user.id ? conn.recipient_id : conn.requester_id;
        const { data: profile } = await supabase
          .from('profiles')
          .select('display_name, avatar_url')
          .eq('id', otherId)
          .single();

        return {
          ...conn,
          other_user_id: otherId,
          other_display_name: profile?.display_name ?? 'Unknown',
          other_avatar_url: profile?.avatar_url ?? null,
        };
      })
    );

    setFriends(enriched.filter((c) => c.status === 'accepted'));
    setPending(enriched.filter((c) => c.status === 'pending' && c.recipient_id === user.id));
    setBlocked(enriched.filter((c) => c.status === 'blocked'));
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchConnections(); }, [fetchConnections]);

  const searchUsers = useCallback(async (query: string): Promise<UserSearchResult[]> => {
    if (!query.trim() || !user) return [];
    const { data, error } = await supabase.rpc('search_users', { search_query: query.trim() });
    if (error || !data) return [];
    return (data as UserSearchResult[]).filter((u) => u.id !== user.id);
  }, [user]);

  const sendRequest = useCallback(async (recipientId: string, relationship = 'friend' as const) => {
    if (!user) return { error: 'Not authenticated' };
    const { error } = await supabase
      .from('friend_connections')
      .insert({ requester_id: user.id, recipient_id: recipientId, status: 'pending', relationship });

    if (error) {
      toast.error(error.message.includes('duplicate') ? 'Already connected or request pending' : error.message);
      return { error: error.message };
    }
    toast.success('Friend request sent');
    await fetchConnections();
    return { error: null };
  }, [user, fetchConnections, toast]);

  const acceptRequest = useCallback(async (connectionId: string) => {
    if (!user) return { error: 'Not authenticated' };
    const { error } = await supabase
      .from('friend_connections')
      .update({ status: 'accepted', updated_at: new Date().toISOString() })
      .eq('id', connectionId);

    if (error) { toast.error(error.message); return { error: error.message }; }
    toast.success('Friend accepted');
    await fetchConnections();
    return { error: null };
  }, [user, fetchConnections, toast]);

  const rejectRequest = useCallback(async (connectionId: string) => {
    if (!user) return { error: 'Not authenticated' };
    const { error } = await supabase
      .from('friend_connections')
      .update({ status: 'rejected', updated_at: new Date().toISOString() })
      .eq('id', connectionId);

    if (error) { toast.error(error.message); return { error: error.message }; }
    toast.info('Request declined');
    await fetchConnections();
    return { error: null };
  }, [user, fetchConnections, toast]);

  const removeFriend = useCallback(async (connectionId: string) => {
    const { error } = await supabase.from('friend_connections').delete().eq('id', connectionId);
    if (error) { toast.error(error.message); return { error: error.message }; }
    toast.success('Friend removed');
    setFriends((prev) => prev.filter((f) => f.id !== connectionId));
    await fetchConnections();
    return { error: null };
  }, [fetchConnections, toast]);

  const blockUser = useCallback(async (connectionId: string) => {
    const { error } = await supabase
      .from('friend_connections')
      .update({ status: 'blocked', updated_at: new Date().toISOString() })
      .eq('id', connectionId);

    if (error) { toast.error(error.message); return { error: error.message }; }
    toast.info('User blocked');
    await fetchConnections();
    return { error: null };
  }, [fetchConnections, toast]);

  return { friends, pending, blocked, loading, searchUsers, sendRequest, acceptRequest, rejectRequest, removeFriend, blockUser, fetchConnections };
}
