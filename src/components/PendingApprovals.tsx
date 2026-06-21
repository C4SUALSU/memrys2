import { useState, useEffect } from 'react';
import { Check, X, Calendar, Clock, User, Heart, Users, Globe } from 'lucide-react';
import { fromZonedTime } from 'date-fns-tz';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';
import { Input } from './ui/Input';
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
  onAccept: (event: ParsedEventPayload, tag: EventTag, startTimeOverride?: string, endTimeOverride?: string) => Promise<void>;
  onReject: (event: ParsedEventPayload) => void;
  isProcessing?: boolean;
}

export function PendingApprovals({ events, onAccept, onReject, isProcessing }: PendingApprovalsProps) {
  const { formatEventTime, toLocalDate, tz } = useTimezone();
  const [tags, setTags] = useState<Record<number, EventTag>>({});
  const [editTimes, setEditTimes] = useState<Record<number, { start: string; end: string }>>({});

  const setTag = (idx: number, tag: EventTag) => {
    setTags((prev) => ({ ...prev, [idx]: tag }));
  };

  const toLocalInput = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const h = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${y}-${m}-${day}T${h}:${min}`;
  };

  useEffect(() => {
    const init: Record<number, { start: string; end: string }> = {};
    events.forEach((ev, i) => {
      init[i] = {
        start: toLocalInput(toLocalDate(ev.start_time)),
        end: toLocalInput(toLocalDate(ev.end_time)),
      };
    });
    setEditTimes(init);
  }, [events]);

  const handleAcceptClick = (event: ParsedEventPayload, tag: EventTag, i: number) => {
    const edited = editTimes[i];
    if (edited) {
      const startUTC = fromZonedTime(new Date(edited.start), tz).toISOString();
      const endUTC = fromZonedTime(new Date(edited.end), tz).toISOString();
      onAccept(event, tag, startUTC, endUTC);
    } else {
      onAccept(event, tag);
    }
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
          const times = editTimes[i];

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

                  {/* Editable date/time fields */}
                  {times && (
                    <div className="grid grid-cols-2 gap-2 mb-2">
                      {event.is_all_day ? (
                        <>
                          <Input
                            label="Start Date"
                            type="date"
                            value={times.start.slice(0, 10)}
                            onChange={(e) => setEditTimes((prev) => ({ ...prev, [i]: { ...prev[i], start: e.target.value + 'T00:00' } }))}
                            className="text-xs"
                          />
                          <Input
                            label="End Date"
                            type="date"
                            value={times.end.slice(0, 10)}
                            onChange={(e) => setEditTimes((prev) => ({ ...prev, [i]: { ...prev[i], end: e.target.value + 'T23:59' } }))}
                            className="text-xs"
                          />
                        </>
                      ) : (
                        <>
                          <Input
                            label="Start"
                            type="datetime-local"
                            value={times.start}
                            onChange={(e) => setEditTimes((prev) => ({ ...prev, [i]: { ...prev[i], start: e.target.value } }))}
                            className="text-xs"
                          />
                          <Input
                            label="End"
                            type="datetime-local"
                            value={times.end}
                            onChange={(e) => setEditTimes((prev) => ({ ...prev, [i]: { ...prev[i], end: e.target.value } }))}
                            className="text-xs"
                          />
                        </>
                      )}
                    </div>
                  )}

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
                  <Button variant="primary" size="sm" onClick={() => handleAcceptClick(event, activeTag, i)} disabled={isProcessing}>
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
