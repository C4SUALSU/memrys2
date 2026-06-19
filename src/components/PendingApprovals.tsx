import { useState } from 'react';
import { Check, X, Calendar, Clock, User, Heart, Users, Globe } from 'lucide-react';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';
import { useTimezone } from '@/hooks/useTimezone';
import type { ParsedEventPayload } from '@/types/app';

export type EventTag = 'personal' | 'partner' | 'family' | 'friend';

const TAG_COLORS: Record<EventTag, { dot: string; bg: string; border: string; text: string; label: string; icon: typeof User }> = {
  personal: { dot: 'bg-sky-400', bg: 'bg-sky-950/20', border: 'border-sky-800/30', text: 'text-sky-400', label: 'Personal', icon: User },
  partner: { dot: 'bg-rose-400', bg: 'bg-rose-950/20', border: 'border-rose-800/30', text: 'text-rose-400', label: 'Partner', icon: Heart },
  family: { dot: 'bg-emerald-400', bg: 'bg-emerald-950/20', border: 'border-emerald-800/30', text: 'text-emerald-400', label: 'Family', icon: Users },
  friend: { dot: 'bg-amber-400', bg: 'bg-amber-950/20', border: 'border-amber-800/30', text: 'text-amber-400', label: 'Friend', icon: Globe },
};

interface PendingApprovalsProps {
  events: ParsedEventPayload[];
  onAccept: (event: ParsedEventPayload, tag: EventTag) => Promise<void>;
  onReject: (event: ParsedEventPayload) => void;
  isProcessing?: boolean;
}

export function PendingApprovals({ events, onAccept, onReject, isProcessing }: PendingApprovalsProps) {
  const { formatEventTime } = useTimezone();
  const [tags, setTags] = useState<Record<number, EventTag>>({});

  const setTag = (idx: number, tag: EventTag) => {
    setTags((prev) => ({ ...prev, [idx]: tag }));
  };

  if (events.length === 0) return null;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Clock className="w-4 h-4 text-amber-400" />
        <h3 className="text-sm font-semibold text-zinc-300">
          Pending Approvals
          <Badge variant="warning">{events.length}</Badge>
        </h3>
      </div>
      <div className="flex flex-col gap-2">
        {events.map((event, i) => {
          const activeTag = tags[i] ?? 'personal';
          const tc = TAG_COLORS[activeTag];

          return (
            <div key={`${event.title}-${event.start_time}-${i}`}
              className={`glass-surface rounded-xl p-4 animate-slide-down border-l-4 ${tc.border}`}
              style={{ animationDelay: `${i * 50}ms` }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <tc.icon className={`w-4 h-4 ${tc.text}`} />
                    <h4 className="font-medium text-zinc-200 truncate">{event.title}</h4>
                    <span className={`text-xs font-medium ${tc.text}`}>{tc.label}</span>
                    {event.is_all_day && <Badge>All day</Badge>}
                  </div>
                  <p className="text-xs text-zinc-500 mb-2">
                    {formatEventTime(event.start_time, event.end_time, event.is_all_day)}
                  </p>

                  {/* Tag selector */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {(Object.entries(TAG_COLORS) as [EventTag, typeof tc][]).map(([key, ct]) => {
                      const Icon = ct.icon;
                      const isActive = activeTag === key;
                      return (
                        <button
                          key={key}
                          onClick={() => setTag(i, key)}
                          className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-all
                            ${isActive
                              ? `${ct.bg} ${ct.text} ${ct.border} border`
                              : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50'
                            }`}
                        >
                          <Icon className="w-3 h-3" />
                          {ct.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0 self-start">
                  <Button variant="primary" size="sm" onClick={() => onAccept(event, activeTag)} disabled={isProcessing}>
                    <Check className="w-3.5 h-3.5" />
                    Accept
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => onReject(event)} disabled={isProcessing}>
                    <X className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
