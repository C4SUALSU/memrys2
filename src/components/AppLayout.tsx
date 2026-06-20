import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Brain, Menu } from 'lucide-react';
import { NavigationSidebar } from './NavigationSidebar';
import { CalendarWorkspace } from './CalendarWorkspace';
import { GroupChatView } from './GroupChatView';
import { SettingsView } from './SettingsView';
import { Spinner } from './ui/Spinner';
import { EmptyState } from './ui/EmptyState';
import { useAuth } from '@/context/AuthContext';
import { useTimeTree, TimeTreeProvider } from '@/context/TimeTreeContext';
import DashboardPage from '@/pages/DashboardPage';
import FriendsPage from '@/pages/FriendsPage';

export function AppLayout() {
  return (
    <TimeTreeProvider>
      <AppLayoutInner />
    </TimeTreeProvider>
  );
}

function AppLayoutInner() {
  const { user, profile, loading: authLoading, refreshProfile } = useAuth();
  const { activeTab, currentSpace, spacesLoading } = useTimeTree();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  if (authLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-zinc-950">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-brand-900/50 border border-brand-800/50 flex items-center justify-center">
            <Brain className="w-6 h-6 text-brand-300 animate-pulse" />
          </div>
          <Spinner />
          <p className="text-sm text-zinc-500">Loading your workspace...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    navigate('/login', { replace: true });
    return null;
  }

  return (
    <div className="flex h-screen overflow-hidden bg-zinc-950">
      <NavigationSidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* Main content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile header */}
        <div className="lg:hidden flex items-center gap-3 px-4 py-3 border-b border-zinc-800/50 glass-surface shrink-0">
          <button onClick={() => setSidebarOpen(true)} className="text-zinc-400 hover:text-zinc-200">
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <Brain className="w-5 h-5 text-brand-300" />
            <span className="font-semibold text-zinc-100">Memrys</span>
          </div>
        </div>

        {spacesLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <Spinner />
          </div>
        ) : (
          <ContentRouter
            activeTab={activeTab}
            currentSpace={currentSpace}
            userProfile={profile}
            onProfileUpdate={refreshProfile}
          />
        )}
      </main>
    </div>
  );
}

function ContentRouter({
  activeTab,
  currentSpace,
  userProfile,
  onProfileUpdate,
}: {
  activeTab: ReturnType<typeof useTimeTree>['activeTab'];
  currentSpace: ReturnType<typeof useTimeTree>['currentSpace'];
  userProfile: ReturnType<typeof useAuth>['profile'];
  onProfileUpdate: ReturnType<typeof useAuth>['refreshProfile'];
}) {
  switch (activeTab) {
    case 'calendar':
      return <CalendarWorkspace currentSpace={currentSpace} />;

    case 'chat':
      if (currentSpace) {
        return <GroupChatView currentSpace={currentSpace} />;
      }
      return (
        <div className="flex-1 flex items-center justify-center">
          <EmptyState
            icon="💬"
            title="Select a shared space"
            description="Choose a shared space calendar from the sidebar to access chat"
          />
        </div>
      );

    case 'friends':
      return <FriendsPage />;

    case 'settings':
      return <SettingsView userProfile={userProfile} onProfileUpdate={onProfileUpdate} />;

    case 'dashboard':
    default:
      return <DashboardPage />;
  }
}
