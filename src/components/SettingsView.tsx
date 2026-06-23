import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { ArrowLeft, Key, Globe, Brain, LogIn, Settings as SettingsIcon, AlertTriangle } from 'lucide-react';
import { Input } from './ui/Input';
import { Button } from './ui/Button';
import { Select } from './ui/Select';
import { Modal } from './ui/Modal';
import { ModelConfigPanel } from './ModelConfigPanel';
import { useAuth } from '@/context/AuthContext';
import { useTimeTree } from '@/context/TimeTreeContext';
import { useToast } from '@/context/ToastContext';
import { supabase } from '@/lib/supabase';
import type { Profile } from '@/types/app';

const MAJOR_TIMEZONES = [
  { value: 'UTC', label: 'Coordinated Universal Time (UTC)' },
  { value: 'America/New_York', label: 'New York / Eastern Time (ET)' },
  { value: 'America/Chicago', label: 'Chicago / Central Time (CT)' },
  { value: 'America/Los_Angeles', label: 'Los Angeles / Pacific Time (PT)' },
  { value: 'Europe/London', label: 'London / Greenwich Mean Time (GMT)' },
  { value: 'Europe/Paris', label: 'Paris / Central European Time (CET)' },
  { value: 'Asia/Singapore', label: 'Singapore / Malaysia Standard Time (SGT)' },
  { value: 'Asia/Tokyo', label: 'Tokyo / Japan Standard Time (JST)' },
  { value: 'Australia/Sydney', label: 'Sydney / Eastern Australian Time (AEST)' },
];

interface SettingsViewProps {
  userProfile: Profile | null;
  onProfileUpdate: () => Promise<void>;
}

type SettingsTab = 'account' | 'timezone' | 'models';

export function SettingsView({ userProfile, onProfileUpdate }: SettingsViewProps) {
  const { user, signOut } = useAuth();
  const { setActiveTab } = useTimeTree();
  const toast = useToast();
  const navigate = useNavigate();

  const [activeTab, setActiveTabState] = useState<SettingsTab>('account');
  const [displayName, setDisplayName] = useState('');
  const [selectedTimezone, setSelectedTimezone] = useState('UTC');
  const [saving, setSaving] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [googleLinkLoading, setGoogleLinkLoading] = useState(false);

  const hasGoogleIdentity = user?.identities?.some((id) => id.provider === 'google') ?? false;

  const handleLinkGoogle = async () => {
    setGoogleLinkLoading(true);
    const { error } = await supabase.auth.linkIdentity({
      provider: 'google',
      options: {
        scopes: 'https://www.googleapis.com/auth/calendar.readonly',
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
        redirectTo: window.location.origin + '/app?tab=settings',
      },
    });
    if (error) {
      toast.error(error.message);
      setGoogleLinkLoading(false);
    }
  };

  useEffect(() => {
    if (userProfile) {
      setDisplayName(userProfile.display_name ?? '');
      setSelectedTimezone(userProfile.timezone || 'UTC');
    }
  }, [userProfile]);

  const handleSaveProfile = async () => {
    if (!userProfile) return;
    setSaving(true);
    const { error } = await supabase
      .from('profiles')
      .update({ display_name: displayName })
      .eq('id', userProfile.id);
    setSaving(false);
    if (!error) {
      await onProfileUpdate();
    }
  };

  const handleTimezoneChange = async (tz: string) => {
    setSelectedTimezone(tz);
    if (!userProfile) return;
    setSaving(true);
    const { error } = await supabase
      .from('profiles')
      .update({ timezone: tz })
      .eq('id', userProfile.id);
    setSaving(false);
    if (!error) {
      await onProfileUpdate();
    }
  };

  const handleDeleteAccount = async () => {
    setDeleting(true);
    const { error } = await supabase.rpc('delete_own_account');
    if (error) {
      setDeleting(false);
      return;
    }
    setShowDeleteModal(false);
    setDeleteConfirmText('');
    await signOut().catch(() => {});
    navigate('/');
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  if (!user) return null;

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-3xl mx-auto px-4 py-8 lg:px-8">
        <button
          onClick={() => setActiveTab('calendar')}
          className="flex items-center gap-1.5 text-sm text-zinc-400 hover:text-zinc-200 transition-colors mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Calendar
        </button>

        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-zinc-800 border border-zinc-700 flex items-center justify-center">
            <SettingsIcon className="w-5 h-5 text-zinc-300" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-zinc-100">Settings</h1>
            <p className="text-sm text-zinc-500">{userProfile?.display_name ?? 'User'} &middot; {user.email}</p>
          </div>
        </div>

        {/* Tab bar */}
        <div className="flex gap-1 mb-6 p-1 rounded-xl bg-zinc-900 border border-zinc-800/50 w-fit">
          <button
            onClick={() => setActiveTabState('account')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200
              ${activeTab === 'account'
                ? 'bg-zinc-800 text-zinc-100 shadow-sm'
                : 'text-zinc-500 hover:text-zinc-300'
              }`}
          >
            <Key className="w-4 h-4" />
            Account
          </button>
          <button
            onClick={() => setActiveTabState('timezone')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200
              ${activeTab === 'timezone'
                ? 'bg-zinc-800 text-zinc-100 shadow-sm'
                : 'text-zinc-500 hover:text-zinc-300'
              }`}
          >
            <Globe className="w-4 h-4" />
            Timezone
          </button>
          <button
            onClick={() => setActiveTabState('models')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200
              ${activeTab === 'models'
                ? 'bg-zinc-800 text-zinc-100 shadow-sm'
                : 'text-zinc-500 hover:text-zinc-300'
              }`}
          >
            <Brain className="w-4 h-4" />
            AI Models
          </button>
        </div>

        <div className="glass-surface rounded-2xl p-6">
          {/* Account tab */}
          {activeTab === 'account' && (
            <div className="flex flex-col gap-6">
              <div>
                <h3 className="text-base font-semibold text-zinc-200 mb-1">Account</h3>
                <p className="text-sm text-zinc-500">{user.email}</p>
              </div>

              <div>
                <h4 className="text-sm font-medium text-zinc-300 mb-3">Display Name</h4>
                <div className="flex items-end gap-2">
                  <Input
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Your display name"
                    className="max-w-xs"
                  />
                  <Button size="sm" loading={saving} onClick={handleSaveProfile} className="h-[42px]">
                    Save
                  </Button>
                </div>
              </div>

              {/* Connected Calendars */}
              <div className="border-t border-zinc-800/50 pt-6">
                <h3 className="text-base font-semibold text-zinc-200 mb-1">Connected Calendars</h3>
                <p className="text-sm text-zinc-500 mb-4">Sync events across your devices and services.</p>
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-zinc-900/50 border border-zinc-800/30">
                    <div className="flex items-center gap-2">
                      <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                      </svg>
                      <span className="text-sm text-zinc-300">Google Calendar</span>
                    </div>
                    {hasGoogleIdentity ? (
                      <span className="text-xs text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded-full border border-emerald-400/20">
                        Connected
                      </span>
                    ) : (
                      <Button
                        size="sm"
                        loading={googleLinkLoading}
                        onClick={handleLinkGoogle}
                        className="text-xs"
                      >
                        Connect
                      </Button>
                    )}
                  </div>
                  <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-zinc-900/50 border border-zinc-800/30 opacity-60 cursor-not-allowed select-none">
                    <span className="text-sm text-zinc-400">&#x1F4F1; Sync with Local Device Calendar</span>
                    <span className="text-[11px] text-zinc-600 uppercase tracking-wider">Coming Soon</span>
                  </div>
                </div>
              </div>

              {/* Danger Zone */}
              <div className="border-t border-red-900/50 pt-6">
                <div className="flex items-center gap-2 mb-4">
                  <AlertTriangle className="w-4 h-4 text-red-400" />
                  <h4 className="text-sm font-semibold text-red-400">Danger Zone</h4>
                </div>

                <div className="space-y-6">
                  <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-zinc-900/50 border border-zinc-800/30">
                    <div>
                      <p className="text-sm font-medium text-zinc-200">Sign Out</p>
                      <p className="text-xs text-zinc-500">End your current session</p>
                    </div>
                    <Button variant="danger" size="sm" onClick={handleSignOut}>
                      <LogIn className="w-4 h-4" />
                      Sign Out
                    </Button>
                  </div>

                  <div className="border-t border-zinc-800/50" />

                  <div className="flex items-start justify-between gap-4">
                    <div className="max-w-sm">
                      <p className="text-sm font-medium text-zinc-200">Delete Account</p>
                      <p className="text-xs text-zinc-500 mt-1">
                        Permanently delete your account and all personal data.
                        Shared spaces with other members will persist without you.
                      </p>
                    </div>
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => setShowDeleteModal(true)}
                      className="shrink-0"
                    >
                      Delete Account
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Timezone tab */}
          {activeTab === 'timezone' && (
            <div className="flex flex-col gap-4">
              <div>
                <h3 className="text-base font-semibold text-zinc-200 mb-1">Timezone</h3>
                <p className="text-sm text-zinc-500 mb-4">All calendar times will be displayed in your local timezone.</p>
              </div>
              <div className="max-w-md">
                <Select
                  label="Select your timezone"
                  options={MAJOR_TIMEZONES}
                  value={selectedTimezone}
                  onChange={(e) => handleTimezoneChange(e.target.value)}
                  disabled={saving || !userProfile}
                />
                <p className="text-xs text-zinc-500 mt-2">
                  <Globe className="w-3 h-3 inline mr-1" />
                  Current: {selectedTimezone.replace(/_/g, ' ')}
                </p>
              </div>
            </div>
          )}

          {/* AI Models tab */}
          {activeTab === 'models' && (
            <div className="flex flex-col gap-4">
              <div>
                <h3 className="text-base font-semibold text-zinc-200 mb-1">AI Models</h3>
                <p className="text-sm text-zinc-500 mb-4">Configure custom AI models for brain dump parsing. API keys are encrypted in Supabase Vault.</p>
              </div>
              <ModelConfigPanel />
            </div>
          )}
        </div>
      </div>

      {/* Delete Account Modal */}
      <Modal open={showDeleteModal} onClose={() => { setShowDeleteModal(false); setDeleteConfirmText(''); }} title="Delete Account">
        <div className="flex flex-col gap-4">
          <div className="flex items-start gap-3 p-3 rounded-lg bg-red-950/30 border border-red-900/30">
            <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <div className="text-sm text-zinc-300">
              <p className="font-medium text-red-300 mb-1">This action cannot be undone</p>
              <p className="text-zinc-400">
                Your profile, messages, event attendance, and connections will be permanently removed.
                Events you created in shared spaces will be preserved without attribution.
              </p>
            </div>
          </div>

          <Input
            label={'Type "DELETE MY ACCOUNT" to confirm'}
            value={deleteConfirmText}
            onChange={(e) => setDeleteConfirmText(e.target.value)}
            placeholder="DELETE MY ACCOUNT"
            className="w-full"
          />

          <div className="flex gap-2 justify-end">
            <Button
              variant="secondary"
              onClick={() => { setShowDeleteModal(false); setDeleteConfirmText(''); }}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              disabled={deleteConfirmText !== 'DELETE MY ACCOUNT'}
              loading={deleting}
              onClick={handleDeleteAccount}
            >
              <AlertTriangle className="w-4 h-4" />
              Delete Account
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
