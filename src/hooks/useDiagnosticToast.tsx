import { useState } from 'react';
import { useToast } from '@/context/ToastContext';
import { supabase } from '@/lib/supabase';
import type { PostgrestError } from '@supabase/supabase-js';
import type { DiagnosticErrorPayload } from '@/types/app';

function extractPayload(err: unknown): DiagnosticErrorPayload {
  if (typeof err === 'object' && err !== null) {
    const e = err as Record<string, unknown>;
    return {
      code: String(e.code ?? 'UNKNOWN'),
      message: String(e.message ?? 'An unexpected error occurred'),
      details: e.details ? String(e.details) : undefined,
      hint: e.hint ? String(e.hint) : undefined,
      table: e.table ? String(e.table) : undefined,
      constraint: e.constraint ? String(e.constraint) : undefined,
    };
  }
  return { code: 'UNKNOWN', message: String(err ?? 'An unexpected error occurred') };
}

export function useDiagnosticToast() {
  const toast = useToast();
  const [diagnostic, setDiagnostic] = useState<DiagnosticErrorPayload | null>(null);

  const showDiagnosticError = (err: unknown) => {
    const payload = extractPayload(err);
    setDiagnostic(payload);
    toast.error(`[${payload.code}] ${payload.message}`);
  };

  const dismissDiagnostic = () => setDiagnostic(null);

  return { diagnostic, showDiagnosticError, dismissDiagnostic };
}

export function DiagnosticModal({
  payload,
  onDismiss,
}: {
  payload: DiagnosticErrorPayload;
  onDismiss: () => void;
}) {
  const toast = useToast();

  const handleCopy = () => {
    navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
    toast.success('Error details copied to clipboard');
  };

  const handleReauth = async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      await supabase.auth.signOut();
      window.location.href = '/login';
    } else {
      toast.success(`Session active: ${data.user.email}`);
      onDismiss();
    }
  };

  return (
    <div className="fixed inset-0 z-[9998] flex items-center justify-center p-4" onClick={onDismiss}>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-lg glass-surface rounded-2xl p-6 shadow-2xl animate-slide-down"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
          <h3 className="text-base font-semibold text-zinc-100">Database Error</h3>
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono px-2 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-zinc-300 uppercase tracking-wider">
              {payload.code}
            </span>
            {payload.table && (
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-zinc-400">
                {payload.table}
              </span>
            )}
          </div>

          <p className="text-sm text-zinc-200 leading-relaxed">{payload.message}</p>

          {payload.details && (
            <div className="rounded-xl bg-zinc-900/80 border border-zinc-800/50 p-3">
              <p className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider mb-1">Details</p>
              <p className="text-xs text-zinc-400 font-mono">{payload.details}</p>
            </div>
          )}

          {payload.hint && (
            <div className="rounded-xl bg-amber-950/20 border border-amber-900/30 p-3">
              <p className="text-[11px] font-semibold text-amber-400 uppercase tracking-wider mb-1">Hint</p>
              <p className="text-xs text-amber-300/80">{payload.hint}</p>
            </div>
          )}

          {payload.constraint && (
            <p className="text-[11px] text-zinc-600 font-mono">
              Constraint: {payload.constraint}
            </p>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 mt-6">
          <button
            onClick={handleReauth}
            className="px-3 py-1.5 rounded-lg text-xs text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50 transition-colors"
          >
            Re-authenticate
          </button>
          <button
            onClick={handleCopy}
            className="px-3 py-1.5 rounded-lg text-xs text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50 transition-colors border border-zinc-800/50"
          >
            Copy Details
          </button>
          <button
            onClick={onDismiss}
            className="px-4 py-1.5 rounded-lg text-xs font-medium text-zinc-100 bg-zinc-800 hover:bg-zinc-700 transition-colors"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}
