import { Users, UserPlus, UserX, MessageSquare, Clock, Check, X, Ban } from 'lucide-react';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';
import { EmptyState } from './ui/EmptyState';
import { Spinner } from './ui/Spinner';
import type { FriendConnectionWithProfile } from '@/types/app';

interface FriendListProps {
  friends: FriendConnectionWithProfile[];
  pending: FriendConnectionWithProfile[];
  blocked: FriendConnectionWithProfile[];
  loading: boolean;
  onAccept: (id: string) => Promise<{ error: string | null }>;
  onReject: (id: string) => Promise<{ error: string | null }>;
  onRemove: (id: string) => Promise<{ error: string | null }>;
  onBlock: (id: string) => Promise<{ error: string | null }>;
  onAddClick: () => void;
  onChatWithFriend?: (otherUserId: string) => void;
}

export function FriendList({ friends, pending, blocked, loading, onAccept, onReject, onRemove, onBlock, onAddClick, onChatWithFriend }: FriendListProps) {

  if (loading) return <Spinner />;

  if (friends.length === 0 && pending.length === 0 && blocked.length === 0) {
    return (
      <EmptyState
        icon="👥"
        title="No friends yet"
        description="Search for people by name or email to connect."
        action={<Button variant="secondary" onClick={onAddClick}><UserPlus className="w-4 h-4" /> Add Friend</Button>}
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {pending.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Clock className="w-4 h-4 text-amber-400" />
            <h3 className="text-sm font-semibold text-zinc-300">Pending Requests</h3>
            <Badge variant="warning">{pending.length}</Badge>
          </div>
          <div className="flex flex-col gap-2">
            {pending.map((req) => (
              <div key={req.id} className="glass-surface rounded-xl p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-zinc-700 flex items-center justify-center text-sm font-medium text-zinc-300">
                    {req.other_display_name?.[0]?.toUpperCase() ?? '?'}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-zinc-200">{req.other_display_name}</p>
                    <p className="text-xs text-zinc-500">Wants to connect</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" onClick={() => onAccept(req.id)}><Check className="w-3.5 h-3.5" /> Accept</Button>
                  <Button variant="ghost" size="sm" onClick={() => onReject(req.id)}><X className="w-3.5 h-3.5" /></Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <div className="flex items-center gap-2 mb-3">
          <Users className="w-4 h-4 text-zinc-400" />
          <h3 className="text-sm font-semibold text-zinc-300">Friends</h3>
          <Badge>{friends.length}</Badge>
        </div>
        <div className="flex flex-col gap-2">
          {friends.map((f) => (
            <div key={f.id} className="glass-surface rounded-xl p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-zinc-700 flex items-center justify-center text-sm font-medium text-zinc-300">
                  {f.other_display_name?.[0]?.toUpperCase() ?? '?'}
                </div>
                <div>
                  <p className="text-sm font-medium text-zinc-200">{f.other_display_name}</p>
                  <p className="text-xs text-zinc-500 capitalize">{f.relationship}</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <Button variant="ghost" size="sm" onClick={() => onChatWithFriend?.(f.other_user_id)}>
                  <MessageSquare className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => onBlock(f.id)}>
                  <Ban className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => onRemove(f.id)} className="text-red-400 hover:text-red-300">
                  <UserX className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {blocked.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Ban className="w-4 h-4 text-red-400" />
            <h3 className="text-sm font-semibold text-zinc-300">Blocked</h3>
            <Badge variant="error">{blocked.length}</Badge>
          </div>
          <div className="flex flex-col gap-2 opacity-60">
            {blocked.map((b) => (
              <div key={b.id} className="glass-surface rounded-xl p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-zinc-700 flex items-center justify-center text-sm font-medium text-zinc-500">!</div>
                  <p className="text-sm font-medium text-zinc-500">{b.other_display_name}</p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => onRemove(b.id)}>Unblock</Button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
