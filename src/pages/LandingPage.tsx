import { useNavigate } from 'react-router';
import { Brain, ArrowRight, Shield, MessageSquare, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/context/AuthContext';

export default function LandingPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  if (user) {
    navigate('/app', { replace: true });
    return null;
  }

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col">
      <header className="flex items-center justify-between px-6 py-4 border-b border-zinc-800/50">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-brand-100 flex items-center justify-center">
            <Brain className="w-4.5 h-4.5 text-zinc-900" />
          </div>
          <span className="font-semibold text-lg text-zinc-100">Memrys</span>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="ghost" onClick={() => navigate('/login?tab=signin')}>
            Sign In
          </Button>
          <Button onClick={() => navigate('/login?tab=signup')}>
            Get Started <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-4 text-center">
        <div className="max-w-2xl">
          <div className="w-20 h-20 rounded-2xl bg-brand-900/50 border border-brand-800/50 flex items-center justify-center mx-auto mb-6">
            <Brain className="w-10 h-10 text-brand-300" />
          </div>
          <h1 className="text-4xl font-bold text-zinc-100 mb-3 tracking-tight">
            Private spaces for the people who matter
          </h1>
          <p className="text-lg text-zinc-500 mb-10 max-w-lg mx-auto leading-relaxed">
            Brain dump your plans, chat in private groups, and keep a shared calendar — all with AI event parsing built in.
          </p>

          <div className="flex items-center justify-center gap-3 mb-12">
            <Button size="md" onClick={() => navigate('/login?tab=signup')}>
              Create Free Account <ArrowRight className="w-4 h-4" />
            </Button>
            <Button variant="secondary" size="md" onClick={() => navigate('/login?tab=signin')}>
              Sign In
            </Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div className="glass-surface rounded-xl p-5 text-left">
              <MessageSquare className="w-5 h-5 text-brand-300 mb-3" />
              <h3 className="font-medium text-zinc-200 mb-1">Private Chat</h3>
              <p className="text-sm text-zinc-500">Group conversations with long-press to forward to calendar.</p>
            </div>
            <div className="glass-surface rounded-xl p-5 text-left">
              <Calendar className="w-5 h-5 text-brand-300 mb-3" />
              <h3 className="font-medium text-zinc-200 mb-1">Brain Dump Calendar</h3>
              <p className="text-sm text-zinc-500">Type naturally and let AI parse events automatically.</p>
            </div>
            <div className="glass-surface rounded-xl p-5 text-left">
              <Shield className="w-5 h-5 text-brand-300 mb-3" />
              <h3 className="font-medium text-zinc-200 mb-1">End-to-End Private</h3>
              <p className="text-sm text-zinc-500">Row-level security ensures only space members see your data.</p>
            </div>
          </div>
        </div>
      </main>

      <footer className="py-4 text-center text-xs text-zinc-700 border-t border-zinc-800/50">
        Memrys v3.0 &middot; Privacy-first microsocial
      </footer>
    </div>
  );
}
