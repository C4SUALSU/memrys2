import { useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router';
import { Mail, LogIn, Key, Globe, Settings, Shield, Brain, ArrowLeft, AlertTriangle } from 'lucide-react';
import { Input } from './ui/Input';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';
import { Modal } from './ui/Modal';
import { TimezonePicker } from './TimezonePicker';
import { ModelConfigPanel } from './ModelConfigPanel';
import { useAuth } from '@/context/AuthContext';
import { useProfile } from '@/hooks/useProfile';
import { useToast } from '@/context/ToastContext';
import { supabase } from '@/lib/supabase';

type SettingsTab = 'auth' | 'timezone' | 'models';

export function AuthAndSettings() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = (searchParams.get('tab') as SettingsTab) || 'auth';
  const { user, signIn, signUp, resetPassword, signOut } = useAuth();
  const { profile, saving, updateProfile } = useProfile();
  const toast = useToast();
  const navigate = useNavigate();
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);

  const setTab = (tab: SettingsTab) => {
    setSearchParams({ tab });
  };

  const handleDeleteAccount = async () => {
    setDeleting(true);
    const { error } = await supabase.rpc('delete_own_account');
    if (error) {
      toast.error(error.message);
      setDeleting(false);
      return;
    }
    toast.success('Account deleted successfully.');
    setShowDeleteModal(false);
    setDeleteConfirmText('');
    await signOut().catch(() => {});
    navigate('/');
  };

  if (!user) {
    const authTab = searchParams.get('tab') || 'signin';
    return <AuthView signIn={signIn} signUp={signUp} resetPassword={resetPassword} defaultTab={authTab === 'signup' ? 'signup' : 'signin'} />;
  }

  const tabs: { id: SettingsTab; icon: typeof Settings; label: string }[] = [
    { id: 'auth', icon: Key, label: 'Account' },
    { id: 'timezone', icon: Globe, label: 'Timezone' },
    { id: 'models', icon: Brain, label: 'AI Models' },
  ];

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-3xl mx-auto px-4 py-8 lg:px-8">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-zinc-800 border border-zinc-700 flex items-center justify-center">
            <Settings className="w-5 h-5 text-zinc-300" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-zinc-100">Settings</h1>
            <p className="text-sm text-zinc-500">{profile?.display_name} &middot; {user.email}</p>
          </div>
        </div>

        <div className="flex gap-1 mb-6 p-1 rounded-xl bg-zinc-900 border border-zinc-800/50 w-fit">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200
                ${activeTab === tab.id
                  ? 'bg-zinc-800 text-zinc-100 shadow-sm'
                  : 'text-zinc-500 hover:text-zinc-300'
                }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        <div className="glass-surface rounded-2xl p-6">
          {activeTab === 'auth' && (
            <div className="flex flex-col gap-6">
              <div>
                <h3 className="text-base font-semibold text-zinc-200 mb-1">Account</h3>
                <p className="text-sm text-zinc-500">{user.email}</p>
              </div>

              <div>
                <h4 className="text-sm font-medium text-zinc-300 mb-3">Display Name</h4>
                <div className="flex items-end gap-2">
                  <Input
                    value={profile?.display_name ?? ''}
                    onChange={(e) => updateProfile({ display_name: e.target.value })}
                    placeholder="Your display name"
                    className="max-w-xs"
                  />
                  <Button size="sm" loading={saving} onClick={() => {}} className="h-[42px]">
                    Save
                  </Button>
                </div>
              </div>

              {/* Connected Calendars */}
              <div className="border-t border-zinc-800/50 pt-6">
                <h3 className="text-base font-semibold text-zinc-200 mb-1">Connected Calendars</h3>
                <p className="text-sm text-zinc-500 mb-4">Sync events across your devices and services.</p>
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-zinc-900/50 border border-zinc-800/30 opacity-60 cursor-not-allowed select-none">
                    <span className="text-sm text-zinc-400">&#x1F517; Sync with Google Calendar</span>
                    <span className="text-[11px] text-zinc-600 uppercase tracking-wider">Coming Soon</span>
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
                    <Button variant="danger" size="sm" onClick={() => signOut()}>
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

          {activeTab === 'timezone' && (
            <div className="flex flex-col gap-4">
              <div>
                <h3 className="text-base font-semibold text-zinc-200 mb-1">Timezone</h3>
                <p className="text-sm text-zinc-500 mb-4">All calendar times will be displayed in your local timezone.</p>
              </div>
              <div className="max-w-md">
                <TimezonePicker
                  value={profile?.timezone ?? 'UTC'}
                  onChange={(tz) => updateProfile({ timezone: tz })}
                  disabled={saving}
                />
              </div>
            </div>
          )}

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

function AuthView({
  signIn,
  signUp,
  resetPassword,
  defaultTab,
}: {
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string, displayName: string) => Promise<{ error: string | null }>;
  resetPassword: (email: string) => Promise<{ error: string | null }>;
  defaultTab: 'signin' | 'signup';
}) {
  const [tab, setTab] = useState<'signin' | 'signup'>(defaultTab);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSent, setForgotSent] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);
  const toast = useToast();

  const handleSignIn = async () => {
    if (!email.trim() || !password.trim()) {
      toast.warning('Please fill in all fields');
      return;
    }
    setLoading(true);
    const result = await signIn(email.trim(), password);
    setLoading(false);
    if (result.error) toast.error(result.error);
  };

  const handleSignUp = async () => {
    if (!email.trim() || !password.trim() || !displayName.trim()) {
      toast.warning('Please fill in all fields');
      return;
    }
    if (password.length < 6) {
      toast.warning('Password must be at least 6 characters');
      return;
    }
    setLoading(true);
    const result = await signUp(email.trim(), password, displayName.trim());
    setLoading(false);
    if (result.error) toast.error(result.error);
    else toast.success('Account created! Check your email to confirm.');
  };

  const handleReset = async () => {
    if (!forgotEmail.trim()) {
      toast.warning('Please enter your email');
      return;
    }
    setForgotLoading(true);
    const result = await resetPassword(forgotEmail.trim());
    setForgotLoading(false);
    if (result.error) toast.error(result.error);
    else {
      setForgotSent(true);
      toast.success('Password reset email sent');
    }
  };

  return (
    <div className="flex-1 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-brand-900/50 border border-brand-800/50 flex items-center justify-center mx-auto mb-4">
            <Brain className="w-8 h-8 text-brand-300" />
          </div>
          <h1 className="text-2xl font-bold text-zinc-100 mb-1">Memrys</h1>
          <p className="text-sm text-zinc-500">Private spaces for the people who matter</p>
        </div>

        <div className="glass-surface rounded-2xl p-6">
          <div className="flex mb-6 p-1 rounded-lg bg-zinc-900 border border-zinc-800/50">
            <button
              onClick={() => { setTab('signin'); setShowForgot(false); }}
              className={`flex-1 py-2 rounded-md text-sm font-medium transition-all ${
                tab === 'signin' ? 'bg-zinc-800 text-zinc-100 shadow-sm' : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              Sign In
            </button>
            <button
              onClick={() => { setTab('signup'); setShowForgot(false); }}
              className={`flex-1 py-2 rounded-md text-sm font-medium transition-all ${
                tab === 'signup' ? 'bg-zinc-800 text-zinc-100 shadow-sm' : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              Create Account
            </button>
          </div>

          {showForgot ? (
            <div className="flex flex-col gap-4">
              <button onClick={() => setShowForgot(false)} className="flex items-center gap-1.5 text-sm text-zinc-400 hover:text-zinc-200">
                <ArrowLeft className="w-4 h-4" /> Back to sign in
              </button>
              {forgotSent ? (
                <div className="text-center py-4">
                  <Mail className="w-10 h-10 text-emerald-400 mx-auto mb-3" />
                  <h3 className="font-semibold text-zinc-200 mb-1">Check your email</h3>
                  <p className="text-sm text-zinc-500">We sent a password reset link to {forgotEmail}</p>
                </div>
              ) : (
                <>
                  <Input
                    label="Email address"
                    type="email"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    placeholder="you@example.com"
                    onKeyDown={(e) => { if (e.key === 'Enter') handleReset(); }}
                  />
                  <Button onClick={handleReset} loading={forgotLoading} className="w-full">
                    <Mail className="w-4 h-4" />
                    Send Reset Link
                  </Button>
                </>
              )}
            </div>
          ) : tab === 'signin' ? (
            <div className="flex flex-col gap-4">
              <Input
                label="Email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                onKeyDown={(e) => { if (e.key === 'Enter') handleSignIn(); }}
              />
              <Input
                label="Password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                onKeyDown={(e) => { if (e.key === 'Enter') handleSignIn(); }}
              />
              <button
                onClick={() => { setShowForgot(true); setForgotEmail(email); }}
                className="text-xs text-brand-300 hover:text-brand-200 text-left -mt-2"
              >
                Forgot password?
              </button>
              <Button onClick={handleSignIn} loading={loading} className="w-full">
                <LogIn className="w-4 h-4" />
                Sign In
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <Input
                label="Display Name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="How others see you"
                onKeyDown={(e) => { if (e.key === 'Enter') handleSignUp(); }}
              />
              <Input
                label="Email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                onKeyDown={(e) => { if (e.key === 'Enter') handleSignUp(); }}
              />
              <Input
                label="Password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 6 characters"
                onKeyDown={(e) => { if (e.key === 'Enter') handleSignUp(); }}
              />
              <Button onClick={handleSignUp} loading={loading} className="w-full">
                <Shield className="w-4 h-4" />
                Create Account
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
