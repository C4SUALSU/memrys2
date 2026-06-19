import { useState } from 'react';
import { Users, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { FriendList } from '@/components/FriendList';
import { AddFriendModal } from '@/components/AddFriendModal';
import { useFriends } from '@/hooks/useFriends';

export default function FriendsPage() {
  const { friends, pending, blocked, loading, acceptRequest, rejectRequest, removeFriend, blockUser } = useFriends();
  const [showAdd, setShowAdd] = useState(false);

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
          />
        </div>
      </div>

      <AddFriendModal open={showAdd} onClose={() => setShowAdd(false)} />
    </div>
  );
}
