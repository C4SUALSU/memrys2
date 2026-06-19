import { X, CheckCircle, AlertCircle, AlertTriangle, Info } from 'lucide-react';
import type { ToastMessage } from '@/types/app';

interface ToastProps {
  toast: ToastMessage;
  onDismiss: (id: string) => void;
}

const iconMap = {
  success: CheckCircle,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
};

const colorMap = {
  success: 'border-emerald-800/50 bg-emerald-950/30',
  error: 'border-red-800/50 bg-red-950/30',
  warning: 'border-amber-800/50 bg-amber-950/30',
  info: 'border-blue-800/50 bg-blue-950/30',
};

const iconColorMap = {
  success: 'text-emerald-400',
  error: 'text-red-400',
  warning: 'text-amber-400',
  info: 'text-blue-400',
};

export function Toast({ toast, onDismiss }: ToastProps) {
  const Icon = iconMap[toast.type];

  return (
    <div
      className={`flex items-start gap-3 p-4 rounded-xl border backdrop-blur-xl shadow-2xl
                  animate-toast-in min-w-[320px] max-w-[420px] ${colorMap[toast.type]}`}
      role="alert"
    >
      <Icon className={`w-5 h-5 mt-0.5 shrink-0 ${iconColorMap[toast.type]}`} />
      <p className="text-sm text-zinc-200 flex-1 leading-relaxed">{toast.message}</p>
      <button
        onClick={() => onDismiss(toast.id)}
        className="shrink-0 text-zinc-500 hover:text-zinc-300 transition-colors"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
