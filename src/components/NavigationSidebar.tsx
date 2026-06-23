import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router';
import {
  Brain, Calendar, Settings, Users, Plus, LogOut, MessageSquare,
  LayoutDashboard, X, Trash2, Edit3, MoreHorizontal,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useTimeTree } from '@/context/TimeTreeContext';
import { useToast } from '@/context/ToastContext';
import { Button } from './ui/Button';
import { Modal } from './ui/Modal';
import { Input } from './ui/Input';
import { Select } from './ui/Select';
import type { SpaceType, Space } from '@/types/app';
import { supabase } from '@/lib/supabase';

const spaceTypeOptions = [
  { value: 'direct_partner', label: 'Direct Partner' },
  { value: 'group_chat', label: 'Group Chat' },
  { value: 'family_circle', label: 'Family Circle' },
];

const spaceTypeColors: Record<SpaceType, string> = {
  direct_partner: 'bg-rose-400',
  group_chat: 'bg-sky-400',
  family_circle: 'bg-emerald-400',
};

function spaceDisplayName(space: Space): string {
  if (space.name) return space.name;
  switch (space.type) {
    case 'direct_partner': return 'Partner';
    case 'family_circle': return 'Family';
    case 'group_chat': return 'Group';
  }
}

interface NavigationSidebarProps {
  open: boolean;
  onClose: () => void;
}

export function NavigationSidebar({ open, onClose }: NavigationSidebarProps) {
  const { user, profile, signOut } = useAuth();
  const { activeTab, currentSpace, spacesList, setActiveTab, setCurrentSpace, refreshSpaces } = useTimeTree();
  const toast = useToast();
  const navigate = useNavigate();

  const [showCreateSpace, setShowCreateSpace] = useState(false);
  const [spaceName, setSpaceName] = useState('');
  const [spaceType, setSpaceType] = useState<SpaceType>('group_chat');
  const [creating, setCreating] = useState(false);

  const [contextMenu, setContextMenu] = useState<{ space: Space; x: number; y: number } | null>(null);
  const [renamingSpace, setRenamingSpace] = useState<Space | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [savingRename, setSavingRename] = useState(false);
  const [deletingSpace, setDeletingSpace] = useState<Space | null>(null);
  const [deleting, setDeleting] = useState(false);

  const contextRef = useRef<HTMLDivElement>(null);

  // Close context menu on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (contextRef.current && !contextRef.current.contains(e.target as Node)) {
        setContextMenu(null);
      }
    };
    if (contextMenu) {
      document.addEventListener('mousedown', handleClick);
    }
    return () => document.removeEventListener('mousedown', handleClick);
  }, [contextMenu]);

  const handleContextMenu = (e: React.MouseEvent, space: Space) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ space, x: e.clientX, y: e.clientY });
  };

  const isOwner = (userId: string | undefined, space: Space): boolean => {
    return space.created_by === userId;
  };

  const handleStartRename = (space: Space) => {
    setRenamingSpace(space);
    setRenameValue(space.name ?? '');
    setContextMenu(null);
  };

  const handleSaveRename = async () => {
    if (!renamingSpace) return;
    setSavingRename(true);
    const { error } = await supabase
      .from('spaces')
      .update({ name: renameValue.trim() || null })
      .eq('id', renamingSpace.id);
    setSavingRename(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success('Space renamed');
      setRenamingSpace(null);
      setRenameValue('');
      await refreshSpaces();
    }
  };

  const handleCancelRename = () => {
    setRenamingSpace(null);
    setRenameValue('');
  };

  const handleStartDelete = (space: Space) => {
    setDeletingSpace(space);
    setContextMenu(null);
  };

  const handleDeleteSpace = async () => {
    if (!deletingSpace) return;
    setDeleting(true);
    const { error } = await supabase
      .from('spaces')
      .delete()
      .eq('id', deletingSpace.id);
    setDeleting(false);
    setDeletingSpace(null);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success('Space deleted');
      if (currentSpace?.id === deletingSpace.id) {
        setCurrentSpace(null);
      }
      await refreshSpaces();
    }
  };

  const handleCreateSpace = async () => {
    if (!user) return;
    setCreating(true);
    const { data, error } = await supabase
      .from('spaces')
      .insert({ name: spaceName || null, type: spaceType, created_by: user.id })
      .select()
      .single();

    setCreating(false);
    if (error) {
      toast.error(error.message);
    } else if (data) {
      toast.success('Space created');

      // Auto-join the creator as a member
      await supabase
        .from('space_members')
        .insert({ space_id: data.id, user_id: user.id, relationship_tag: 'Friend' });

      setShowCreateSpace(false);
      setSpaceName('');
      await refreshSpaces();
      setCurrentSpace(data as Space);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const isPersonalActive = activeTab === 'calendar' && currentSpace === null;

  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed lg:static inset-y-0 left-0 z-40 w-64 glass-surface border-r border-zinc-800/50
          flex flex-col transition-transform duration-300
          ${open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        {/* Brand header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-brand-100 flex items-center justify-center">
              <Brain className="w-4.5 h-4.5 text-zinc-900" />
            </div>
            <span className="font-semibold text-zinc-100">Memrys</span>
          </div>
          <button
            className="lg:hidden text-zinc-400 hover:text-zinc-200"
            onClick={onClose}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Identity section */}
        <div className="px-4 py-3 border-b border-zinc-800/50">
          <button
            onClick={() => { setActiveTab('settings'); onClose(); }}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-zinc-800/50 transition-colors group"
          >
            <div className="w-9 h-9 rounded-full bg-brand-900/50 border border-brand-800/50 flex items-center justify-center text-sm font-semibold text-brand-300 shrink-0 group-hover:border-brand-700/50 transition-colors">
              {profile?.display_name?.[0]?.toUpperCase() ?? '?'}
            </div>
            <div className="flex-1 min-w-0 text-left">
              <p className="text-sm font-medium text-zinc-200 truncate">
                {profile?.display_name ?? 'User'}
              </p>
              <p className="text-[11px] text-zinc-500 truncate">
                {user?.email}
              </p>
            </div>
            <Settings className="w-3.5 h-3.5 text-zinc-600 group-hover:text-zinc-400 transition-colors shrink-0" />
          </button>
        </div>

        {/* Nav items */}
        <nav className="flex flex-col gap-0.5 px-3 py-3">
          {/* Dashboard */}
          <button
            onClick={() => { setActiveTab('dashboard'); onClose(); }}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors
              ${activeTab === 'dashboard' ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'}`}
          >
            <LayoutDashboard className="w-4 h-4" />
            Dashboard
          </button>

          {/* Personal Calendar */}
          <button
            onClick={() => { setCurrentSpace(null); onClose(); }}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all
              ${isPersonalActive
                ? 'bg-brand-900/30 text-brand-200 border border-brand-800/40'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50 border border-transparent'}`}
          >
            <Calendar className="w-4 h-4" />
            Personal Calendar
          </button>

          {/* Friends */}
          <button
            onClick={() => { setActiveTab('friends'); onClose(); }}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors
              ${activeTab === 'friends' ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'}`}
          >
            <Users className="w-4 h-4" />
            Friends
          </button>
        </nav>

        {/* Shared Calendars */}
        <div className="flex-1 overflow-y-auto border-t border-zinc-800/50">
          <div className="flex items-center justify-between px-5 pt-3 pb-1">
            <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
              Shared Calendars
            </h3>
          </div>
          <div className="px-3 flex flex-col gap-0.5 pb-4">
            {spacesList.map((space) => {
              const isActive = currentSpace?.id === space.id && activeTab === 'calendar';
              return (
                <div key={space.id} className="relative group">
                  <button
                    onClick={() => { setCurrentSpace(space); onClose(); }}
                    onContextMenu={(e) => handleContextMenu(e, space)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors
                      ${isActive ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'}`}
                  >
                    <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${spaceTypeColors[space.type]}`} />
                    <span className="truncate flex-1 text-left">{spaceDisplayName(space)}</span>
                    {currentSpace?.id === space.id && activeTab === 'chat' && (
                      <MessageSquare className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                    )}
                    <button
                      onClick={(e) => handleContextMenu(e, space)}
                      className="opacity-0 group-hover:opacity-100 text-zinc-500 hover:text-zinc-200 transition-all shrink-0"
                    >
                      <MoreHorizontal className="w-3.5 h-3.5" />
                    </button>
                  </button>
                </div>
              );
            })}
            {spacesList.length === 0 && (
              <p className="text-xs text-zinc-600 px-3 py-4 text-center">
                No shared spaces yet
              </p>
            )}
          </div>
        </div>

        {/* Create / Join Space */}
        <div className="border-t border-zinc-800/50 px-3 py-3">
          <button
            onClick={() => setShowCreateSpace(true)}
            className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm text-zinc-400
                       hover:text-zinc-200 hover:bg-zinc-800/50 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Create / Join Shared Space
          </button>
        </div>

        {/* User footer */}
        <div className="border-t border-zinc-800/50 px-5 py-3 flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-zinc-700 flex items-center justify-center text-sm font-medium text-zinc-300">
            {profile?.display_name?.[0]?.toUpperCase() ?? '?'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-zinc-200 truncate">
              {profile?.display_name ?? 'User'}
            </p>
            <p className="text-xs text-zinc-500 truncate">{user?.email}</p>
          </div>
          <button onClick={handleSignOut} className="text-zinc-500 hover:text-red-400 transition-colors">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </aside>

      {/* Context menu */}
      {contextMenu && (
        <div
          ref={contextRef}
          className="fixed z-50 w-44 rounded-xl bg-zinc-900 border border-zinc-700/50 shadow-xl py-1"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <button
            onClick={() => handleStartRename(contextMenu.space)}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-800 transition-colors"
          >
            <Edit3 className="w-3.5 h-3.5" />
            Rename
          </button>
          {isOwner(user?.id, contextMenu.space) && (
            <button
              onClick={() => handleStartDelete(contextMenu.space)}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-red-950/30 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Delete
            </button>
          )}
        </div>
      )}

      {/* Rename space modal */}
      <Modal open={!!renamingSpace} onClose={handleCancelRename} title="Rename Space">
        <div className="flex flex-col gap-4">
          <Input
            label="Space name"
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            placeholder="Enter new name"
            onKeyDown={(e) => { if (e.key === 'Enter') handleSaveRename(); if (e.key === 'Escape') handleCancelRename(); }}
            autoFocus
          />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={handleCancelRename}>Cancel</Button>
            <Button onClick={handleSaveRename} loading={savingRename}>
              <Edit3 className="w-4 h-4" />
              Rename
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete space confirmation modal */}
      <Modal open={!!deletingSpace} onClose={() => setDeletingSpace(null)} title="Delete Space">
        <div className="flex flex-col gap-4">
          <p className="text-sm text-zinc-300">
            Are you sure you want to delete <strong>{deletingSpace ? spaceDisplayName(deletingSpace) : ''}</strong>?
            All events, messages, and member data will be permanently removed.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setDeletingSpace(null)}>Cancel</Button>
            <Button variant="danger" onClick={handleDeleteSpace} loading={deleting}>
              <Trash2 className="w-4 h-4" />
              Delete
            </Button>
          </div>
        </div>
      </Modal>

      {/* Create space modal */}
      <Modal open={showCreateSpace} onClose={() => setShowCreateSpace(false)} title="Create Space">
        <div className="flex flex-col gap-4">
          <Input
            label="Space name (optional)"
            value={spaceName}
            onChange={(e) => setSpaceName(e.target.value)}
            placeholder="e.g. Family Chat"
          />
          <Select
            label="Space type"
            options={spaceTypeOptions}
            value={spaceType}
            onChange={(e) => setSpaceType(e.target.value as SpaceType)}
          />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setShowCreateSpace(false)}>Cancel</Button>
            <Button onClick={handleCreateSpace} loading={creating}>Create</Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
