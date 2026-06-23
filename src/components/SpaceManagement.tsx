import { useState, useEffect } from 'react';
import { Search, UserPlus, Trash2, Loader2 } from 'lucide-react';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { useSpaceMembers } from '@/hooks/useSpaceMembers';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { useDiagnosticToast, DiagnosticModal } from '@/hooks/useDiagnosticToast';
import { supabase } from '@/lib/supabase';
import type { Space, UserSearchResult, SpaceMemberWithProfile } from '@/types/app';

const TAG_OPTIONS = [
  { value: 'Friend', label: 'Friend 👥' },
  { value: 'Partner', label: 'Partner 🌹' },
  { value: 'Family', label: 'Family 🏡' },
  { value: 'Work', label: 'Work 💼' },
  { value: 'Other', label: 'Other 🔗' },
];

interface SpaceManagementProps {
  space: Space;
  open: boolean;
  onClose: () => void;
}

export function SpaceManagement({ space, open, onClose }: SpaceManagementProps) {
  const { user } = useAuth();
  const toast = useToast();
  const { diagnostic, showDiagnosticError, dismissDiagnostic } = useDiagnosticToast();
  const {
    members, loading: membersLoading, inviteUser, kickMember, fetchMembers,
  } = useSpaceMembers(space.id);

  // Local members copy for optimistic tag updates
  const [localMembers, setLocalMembers] = useState<SpaceMemberWithProfile[]>([]);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [invitingId, setInvitingId] = useState<string | null>(null);

  const isOwner = space.created_by === user?.id;

  useEffect(() => {
    setLocalMembers(members);
  }, [members]);

  useEffect(() => {
    if (open) fetchMembers();
  }, [open, fetchMembers]);

  const handleSearch = async () => {
    if (!searchQuery.trim() || !user) return;
    setSearching(true);
    const { data, error } = await supabase.rpc('search_users', {
      search_query: searchQuery.trim(),
    });
    setSearching(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    const results = (data as UserSearchResult[] || []).filter((u) => u.id !== user.id);
    setSearchResults(results);
    if (results.length === 0) toast.info('No users found');
  };

  const handleInvite = async (targetUserId: string) => {
    setInvitingId(targetUserId);
    const result = await inviteUser(targetUserId);
    setInvitingId(null);
    if (!result.error) {
      toast.success('Member added');
      setSearchResults((prev) => prev.filter((r) => r.id !== targetUserId));
    } else {
      toast.error(result.error);
    }
  };

  const handleKick = async (targetUserId: string, displayName: string) => {
    const result = await kickMember(targetUserId);
    if (!result.error) {
      toast.success(`${displayName} removed from space`);
    } else {
      toast.error(result.error);
    }
  };

  const handleTagChange = async (memberId: string, selectedTag: string) => {
    const { error } = await supabase
      .from('space_members')
      .update({ relationship_tag: selectedTag })
      .eq('id', memberId);

    if (error) {
      console.error('Tag Write Failure:', error);
      showDiagnosticError(error);
    } else {
      toast.success(`Tag updated to ${selectedTag}`);
      setLocalMembers((prev) =>
        prev.map((m) => (m.id === memberId ? { ...m, relationship_tag: selectedTag } : m))
      );
      fetchMembers();
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={`Manage Members — ${space.name || space.type.replace('_', ' ')}`}>
      <div className="flex flex-col gap-4 min-h-[300px] max-h-[70vh]">
        {/* Search and add */}
        <div className="flex gap-2">
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name or email..."
            className="flex-1"
            onKeyDown={(e) => { if (e.key === 'Enter') handleSearch(); }}
          />
          <Button onClick={handleSearch} loading={searching} size="sm">
            <Search className="w-4 h-4" />
          </Button>
        </div>

        {/* Search results */}
        {searchResults.length > 0 && (
          <div className="flex flex-col gap-1.5 max-h-40 overflow-y-auto rounded-xl bg-zinc-900/50 border border-zinc-800/30 p-2">
            {searchResults.map((result) => (
              <div key={result.id} className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-zinc-800/50 transition-colors">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-full bg-zinc-700 flex items-center justify-center text-xs font-medium text-zinc-300">
                    {result.display_name?.[0]?.toUpperCase() ?? '?'}
                  </div>
                  <span className="text-sm text-zinc-200">{result.display_name}</span>
                </div>
                <Button
                  size="sm"
                  onClick={() => handleInvite(result.id)}
                  loading={invitingId === result.id}
                >
                  <UserPlus className="w-3.5 h-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}

        {/* Divider */}
        <div className="border-t border-zinc-800/50" />

        {/* Members list */}
        <div className="flex-1 overflow-y-auto">
          {membersLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-zinc-500" />
            </div>
          ) : localMembers.length === 0 ? (
            <p className="text-sm text-zinc-500 text-center py-8">No members yet</p>
          ) : (
            <div className="flex flex-col gap-1">
              {localMembers.map((member) => (
                <MemberRow
                  key={member.id}
                  member={member}
                  isOwner={isOwner}
                  isCurrentUser={member.user_id === user?.id}
                  onKick={handleKick}
                  onTagChange={handleTagChange}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Diagnostic modal */}
      {diagnostic && (
        <DiagnosticModal payload={diagnostic} onDismiss={dismissDiagnostic} />
      )}
    </Modal>
  );
}

function MemberRow({
  member,
  isOwner,
  isCurrentUser,
  onKick,
  onTagChange,
}: {
  member: SpaceMemberWithProfile;
  isOwner: boolean;
  isCurrentUser: boolean;
  onKick: (userId: string, displayName: string) => Promise<void>;
  onTagChange: (memberId: string, relationshipTag: string) => Promise<void>;
}) {
  const [kicking, setKicking] = useState(false);

  const handleKickClick = async () => {
    setKicking(true);
    await onKick(member.user_id, member.display_name);
    setKicking(false);
  };

  const currentTag = member.relationship_tag || 'Friend';

  return (
    <div className="flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-zinc-800/30 transition-colors">
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div className="w-8 h-8 rounded-full bg-zinc-700 flex items-center justify-center text-xs font-medium text-zinc-300 shrink-0">
          {member.display_name?.[0]?.toUpperCase() ?? '?'}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-zinc-200 truncate">
            {member.display_name}
            {isCurrentUser && <span className="text-zinc-500 font-normal"> (you)</span>}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {isCurrentUser && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-400">Tag as:</span>
            <select
              value={currentTag}
              onChange={(e) => onTagChange(member.id, e.target.value)}
              className="bg-zinc-800 text-zinc-100 border border-zinc-700 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {TAG_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        )}
        {(isOwner || isCurrentUser) && (
          <button
            onClick={handleKickClick}
            disabled={kicking}
            className="text-zinc-500 hover:text-red-400 transition-colors disabled:opacity-50 p-1"
            title={isCurrentUser ? 'Leave space' : 'Remove member'}
          >
            {kicking ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Trash2 className="w-4 h-4" />
            )}
          </button>
        )}
      </div>
    </div>
  );
}
