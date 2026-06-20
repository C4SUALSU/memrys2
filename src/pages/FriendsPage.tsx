import { useState, useCallback } from 'react';
import { Users, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { FriendList } from '@/components/FriendList';
import { AddFriendModal } from '@/components/AddFriendModal';
import { useFriends } from '@/hooks/useFriends';
import { useTimeTree } from '@/context/TimeTreeContext';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { supabase } from '@/lib/supabase';
import type { Space } from '@/types/app';

export default function FriendsPage() {
  const { friends, pending, blocked, loading, acceptRequest, rejectRequest, removeFriend, blockUser } = useFriends();
  const { setCurrentSpace, refreshSpaces } = useTimeTree();
  const { user } = useAuth();
  const toast = useToast();
  const [showAdd, setShowAdd] = useState(false);

  const handleChatWithFriend = useCallback(async (otherUserId: string) => {
    if (!user) return;

    const { data: existing } = await supabase
      .from('spaces')
      .select('*')
      .eq('type', 'direct_partner')
      .or(`created_by.eq.${user.id},id.in.(select space_id from space_members where user_id=eq.${user.id})`)
      .limit(1);

    if (existing && existing.length > 0) {
      setCurrentSpace(existing[0] as Space);
      return;
    }

    const { data: newSpace, error } = await supabase
      .from('spaces')
      .insert({ name: null, type: 'direct_partner', created_by: user.id })
      .select()
      .single();

    if (error) {
      toast.error('Failed to create space');
      return;
    }

    await supabase.from('space_members').insert({ space_id: newSpace.id, user_id: otherUserId });
    await refreshSpaces();
    setCurrentSpace(newSpace as Space);
  }, [user, setCurrentSpace, refreshSpaces, toast]);

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-2xl mx-auto px-4 py-8 lg:px-8">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-zinc-800 border border-zinc-700 flex items-center justify-center">
              <Users className="w-5 h-5 text-zinc-300" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-zinc-100">Friends</h1>
              <p className="text-sm text-zinc-500">{friends.length} friend{friends.length !== 1 ? 's' : ''}</p>
            </div>
          </div>
          <Button onClick={() => setShowAdd(true)}>
            <UserPlus className="w-4 h-4" />
            Add Friend
          </Button>
        </div>

        <div className="glass-surface rounded-2xl p-5">
          <FriendList
            friends={friends}
            pending={pending}
            blocked={blocked}
            loading={loading}
            onAccept={acceptRequest}
            onReject={rejectRequest}
            onRemove={removeFriend}
            onBlock={blockUser}
            onAddClick={() => setShowAdd(true)}
            onChatWithFriend={handleChatWithFriend}
          />
        </div>
      </div>

      <AddFriendModal open={showAdd} onClose={() => setShowAdd(false)} />
    </div>
  );
}
