import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router';
import { Calendar, MessageSquare, Settings, Brain, Users, UserPlus, Plus, LogOut, Menu, X } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useSpaces } from '@/hooks/useSpaces';
import { Button } from './ui/Button';
import { Modal } from './ui/Modal';
import { Input } from './ui/Input';
import { Select } from './ui/Select';
import { useToast } from '@/context/ToastContext';
import type { SpaceType } from '@/types/app';

const spaceTypeOptions = [
  { value: 'direct_partner', label: 'Direct Partner' },
  { value: 'group_chat', label: 'Group Chat' },
  { value: 'family_circle', label: 'Family Circle' },
];

export function Layout() {
  const { user, profile, signOut } = useAuth();
  const { spaces, createSpace } = useSpaces();
  const toast = useToast();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showCreateSpace, setShowCreateSpace] = useState(false);
  const [spaceName, setSpaceName] = useState('');
  const [spaceType, setSpaceType] = useState<SpaceType>('group_chat');
  const [creating, setCreating] = useState(false);

  const handleCreateSpace = async () => {
    if (!user) return;
    setCreating(true);
    const result = await createSpace(spaceName || null, spaceType, user.id);
    setCreating(false);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success('Space created');
      setShowCreateSpace(false);
      setSpaceName('');
      navigate(`/chat/${result.data!.id}`);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  return (
    <div className="flex h-screen overflow-hidden bg-zinc-950">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed lg:static inset-y-0 left-0 z-40 w-64 glass-surface border-r border-zinc-800/50
        flex flex-col transition-transform duration-300
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        {/* Brand */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-brand-100 flex items-center justify-center">
              <Brain className="w-4.5 h-4.5 text-zinc-900" />
            </div>
            <span className="font-semibold text-zinc-100">Memrys</span>
          </div>
          <button className="lg:hidden text-zinc-400 hover:text-zinc-200" onClick={() => setSidebarOpen(false)}>
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex flex-col gap-0.5 px-3 py-3">
          <NavLink to="/calendar" className={({ isActive }) =>
            `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors
             ${isActive ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'}`
          }>
            <Calendar className="w-4 h-4" />
            Calendar
          </NavLink>
          <NavLink to="/settings" className={({ isActive }) =>
            `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors
             ${isActive ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'}`
          }>
            <Settings className="w-4 h-4" />
            Settings
          </NavLink>
          <NavLink to="/friends" className={({ isActive }) =>
            `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors
             ${isActive ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'}`
          }>
            <UserPlus className="w-4 h-4" />
            Friends
          </NavLink>
        </nav>

        {/* Spaces */}
        <div className="flex-1 overflow-y-auto border-t border-zinc-800/50">
          <div className="flex items-center justify-between px-5 py-3">
            <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Spaces</h3>
            <button onClick={() => setShowCreateSpace(true)} className="text-zinc-500 hover:text-zinc-200 transition-colors">
              <Plus className="w-4 h-4" />
            </button>
          </div>
          <div className="px-3 flex flex-col gap-0.5 pb-4">
            {spaces.map((space) => (
              <NavLink key={space.id} to={`/chat/${space.id}`} className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors
                 ${isActive ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'}`
              }>
                <Users className="w-4 h-4" />
                <span className="truncate">{space.name || space.type.replace('_', ' ')}</span>
              </NavLink>
            ))}
            {spaces.length === 0 && (
              <p className="text-xs text-zinc-600 px-3 py-4 text-center">No spaces yet</p>
            )}
          </div>
        </div>

        {/* User footer */}
        <div className="border-t border-zinc-800/50 px-5 py-3 flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-zinc-700 flex items-center justify-center text-sm font-medium text-zinc-300">
            {profile?.display_name?.[0]?.toUpperCase() ?? '?'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-zinc-200 truncate">{profile?.display_name ?? 'User'}</p>
            <p className="text-xs text-zinc-500 truncate">{user?.email}</p>
          </div>
          <button onClick={handleSignOut} className="text-zinc-500 hover:text-red-400 transition-colors">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile header */}
        <div className="lg:hidden flex items-center gap-3 px-4 py-3 border-b border-zinc-800/50 glass-surface">
          <button onClick={() => setSidebarOpen(true)} className="text-zinc-400 hover:text-zinc-200">
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <Brain className="w-5 h-5 text-brand-300" />
            <span className="font-semibold text-zinc-100">Memrys</span>
          </div>
        </div>
        <Outlet />
      </main>

      {/* Create space modal */}
      <Modal open={showCreateSpace} onClose={() => setShowCreateSpace(false)} title="Create Space">
        <div className="flex flex-col gap-4">
          <Input label="Space name (optional)" value={spaceName} onChange={(e) => setSpaceName(e.target.value)} placeholder="e.g. Family Chat" />
          <Select label="Space type" options={spaceTypeOptions} value={spaceType} onChange={(e) => setSpaceType(e.target.value as SpaceType)} />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setShowCreateSpace(false)}>Cancel</Button>
            <Button onClick={handleCreateSpace} loading={creating}>Create</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
