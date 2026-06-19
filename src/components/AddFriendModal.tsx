import { useState } from 'react';
import { Search, UserPlus, Loader2 } from 'lucide-react';
import { Button } from './ui/Button';
import { Modal } from './ui/Modal';
import { useFriends } from '@/hooks/useFriends';
import { useToast } from '@/context/ToastContext';
import type { UserSearchResult } from '@/types/app';

interface AddFriendModalProps {
  open: boolean;
  onClose: () => void;
}

export function AddFriendModal({ open, onClose }: AddFriendModalProps) {
  const { searchUsers, sendRequest } = useFriends();
  const toast = useToast();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<UserSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [sending, setSending] = useState<Record<string, boolean>>({});

  const handleSearch = async () => {
    if (!query.trim()) {
      toast.warning('Enter a name or email to search');
      return;
    }
    setSearching(true);
    const users = await searchUsers(query);
    setResults(users);
    setSearching(false);
    if (users.length === 0) toast.info('No users found');
  };

  const handleSend = async (userId: string) => {
    setSending((prev) => ({ ...prev, [userId]: true }));
    await sendRequest(userId);
    setSending((prev) => ({ ...prev, [userId]: false }));
    setResults((prev) => prev.filter((r) => r.id !== userId));
  };

  return (
    <Modal open={open} onClose={onClose} title="Add Friend">
      <div className="flex flex-col gap-4">
        <div className="flex gap-2">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name or email..."
            className="input-field flex-1"
            onKeyDown={(e) => { if (e.key === 'Enter') handleSearch(); }}
          />
          <Button onClick={handleSearch} loading={searching} size="sm">
            <Search className="w-4 h-4" />
          </Button>
        </div>

        {results.length > 0 && (
          <div className="flex flex-col gap-2 max-h-60 overflow-y-auto">
            {results.map((user) => (
              <div key={user.id} className="flex items-center justify-between p-3 rounded-xl bg-zinc-800/50 border border-zinc-800/50">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-zinc-700 flex items-center justify-center text-xs font-medium text-zinc-300">
                    {user.display_name?.[0]?.toUpperCase() ?? '?'}
                  </div>
                  <p className="text-sm font-medium text-zinc-200">{user.display_name}</p>
                </div>
                <Button
                  size="sm"
                  variant="primary"
                  onClick={() => handleSend(user.id)}
                  loading={sending[user.id]}
                >
                  {!sending[user.id] && <UserPlus className="w-3.5 h-3.5" />}
                  {sending[user.id] ? 'Sending...' : 'Add'}
                </Button>
              </div>
            ))}
          </div>
        )}

        {results.length === 0 && !searching && query.trim() && (
          <p className="text-sm text-zinc-500 text-center py-4">
            No users found for "{query}"
          </p>
        )}
      </div>
    </Modal>
  );
}
