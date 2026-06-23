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

  // Redirect authenticated users from /login to /app
  if (window.location.pathname === '/login') {
    navigate('/app', { replace: true });
    return null;
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
  const navigate = useNavigate();
  const [tab, setTab] = useState<'signin' | 'signup'>(defaultTab);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSent, setForgotSent] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const toast = useToast();

  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        scopes: 'https://www.googleapis.com/auth/calendar.readonly',
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
        redirectTo: window.location.origin + '/app',
      },
    });
    if (error) {
      toast.error(error.message);
      setGoogleLoading(false);
    }
  };

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
    else navigate('/check-email');
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

              <div className="relative my-2">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-zinc-800/50" />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="px-2 bg-zinc-950 text-zinc-600">or continue with</span>
                </div>
              </div>

              <button
                onClick={handleGoogleLogin}
                disabled={googleLoading}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium text-zinc-200
                           bg-zinc-900 border border-zinc-700/50 hover:bg-zinc-800 hover:border-zinc-600/50
                           transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                {googleLoading ? 'Connecting...' : 'Sign in with Google'}
              </button>
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

              <div className="relative my-2">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-zinc-800/50" />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="px-2 bg-zinc-950 text-zinc-600">or continue with</span>
                </div>
              </div>

              <button
                onClick={handleGoogleLogin}
                disabled={googleLoading}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium text-zinc-200
                           bg-zinc-900 border border-zinc-700/50 hover:bg-zinc-800 hover:border-zinc-600/50
                           transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                {googleLoading ? 'Connecting...' : 'Sign in with Google'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
