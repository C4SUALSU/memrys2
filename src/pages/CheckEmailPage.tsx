import { Mail, LogIn } from 'lucide-react';
import { useNavigate } from 'react-router';
import { Button } from '@/components/ui/Button';

export default function CheckEmailPage() {
  const navigate = useNavigate();

  return (
    <div className="flex-1 flex items-center justify-center px-4">
      <div className="w-full max-w-sm text-center">
        <div className="w-16 h-16 rounded-2xl bg-emerald-900/50 border border-emerald-800/50 flex items-center justify-center mx-auto mb-4">
          <Mail className="w-8 h-8 text-emerald-300" />
        </div>
        <h1 className="text-2xl font-bold text-zinc-100 mb-2">Check Your Email</h1>
        <p className="text-sm text-zinc-400 leading-relaxed mb-8">
          Please check your email to confirm your account creation, then return to this page to log in with your credentials.
        </p>
        <Button onClick={() => navigate('/login?tab=signin')} className="w-full">
          <LogIn className="w-4 h-4" />
          Go to Login
        </Button>
      </div>
    </div>
  );
}
