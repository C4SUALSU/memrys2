import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router';
import {
  Calendar, Users, ArrowRight, Clock, MessageSquare,
  Sparkles, Plus,
} from 'lucide-react';
import {
  format, isToday, isTomorrow, isThisWeek, parseISO, isBefore,
  startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, addMonths,
  isSameMonth, isSameDay,
} from 'date-fns';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/context/AuthContext';
import { useTimeTree } from '@/context/TimeTreeContext';
import { supabase } from '@/lib/supabase';
import type { CalendarEvent, Space } from '@/types/app';

const spaceDotColors: Record<string, string> = {
  direct_partner: 'bg-rose-400',
  group_chat: 'bg-sky-400',
  family_circle: 'bg-emerald-400',
};

function urgencyLabel(event: CalendarEvent): string {
  const start = parseISO(event.start_time);
  if (isToday(start)) return 'Today';
  if (isTomorrow(start)) return 'Tomorrow';
  if (isThisWeek(start)) return 'This Week';
  return 'Upcoming';
}

function urgencyColor(label: string): string {
  switch (label) {
    case 'Today': return 'text-rose-400';
    case 'Tomorrow': return 'text-amber-400';
    case 'This Week': return 'text-sky-400';
    default: return 'text-zinc-500';
  }
}

export default function DashboardPage() {
  const { profile } = useAuth();
  const { spacesList, setActiveTab, setCurrentSpace } = useTimeTree();
  const navigate = useNavigate();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(true);

  useEffect(() => {
    async function fetchUpcoming() {
      setEventsLoading(true);
      const now = new Date().toISOString();
      const { data } = await supabase
        .from('calendar_events')
        .select('*')
        .gte('end_time', now)
        .order('start_time', { ascending: true })
        .limit(20);
      if (data) {
        setEvents(data as CalendarEvent[]);
      }
      setEventsLoading(false);
    }
    fetchUpcoming();
  }, []);

  const upcomingEvents = useMemo(() => {
    return events.slice(0, 5);
  }, [events]);

  const now = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);
  const calStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
  const miniDays: Date[] = [];
  let d = calStart;
  while (d <= calEnd) { miniDays.push(d); d = addDays(d, 1); }

  const eventsByDay = useMemo(() => {
    const map = new Map<string, number>();
    events.forEach((ev) => {
      const key = format(parseISO(ev.start_time), 'yyyy-MM-dd');
      map.set(key, (map.get(key) || 0) + 1);
    });
    return map;
  }, [events]);

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-5xl mx-auto px-4 py-8 lg:px-8">
        {/* Welcome */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-zinc-100">
            Hello, {profile?.display_name || 'there'}
          </h1>
          <p className="text-sm text-zinc-500 mt-1">
            {format(now, 'EEEE, MMMM d, yyyy')}
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Upcoming Events — spans 2 cols */}
          <div className="lg:col-span-2 glass-surface rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-zinc-200 uppercase tracking-wider">
                Upcoming Events
              </h2>
              <Button variant="ghost" size="sm" onClick={() => setActiveTab('calendar')}>
                View All <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            </div>

            {eventsLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="w-5 h-5 border-2 border-zinc-600 border-t-brand-300 rounded-full animate-spin" />
              </div>
            ) : upcomingEvents.length === 0 ? (
              <div className="text-center py-8">
                <Calendar className="w-8 h-8 text-zinc-700 mx-auto mb-2" />
                <p className="text-sm text-zinc-500">No upcoming events</p>
                <Button size="sm" className="mt-3" onClick={() => setActiveTab('calendar')}>
                  <Plus className="w-4 h-4" />
                  Add an event
                </Button>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {upcomingEvents.map((ev) => {
                  const urgency = urgencyLabel(ev);
                  return (
                    <div
                      key={ev.id}
                      className="flex items-center gap-3 p-3 rounded-xl bg-zinc-800/30 border border-zinc-800/30 hover:border-zinc-700/50 transition-colors cursor-pointer"
                      onClick={() => setActiveTab('calendar', ev.space_id)}
                    >
                      <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${ev.space_id ? 'bg-brand-400' : 'bg-sky-400'}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-zinc-200 truncate">{ev.title}</p>
                        <p className="text-xs text-zinc-500">
                          <Clock className="w-3 h-3 inline mr-1" />
                          {ev.is_all_day
                            ? format(parseISO(ev.start_time), 'MMM d')
                            : format(parseISO(ev.start_time), 'MMM d · h:mm a')}
                        </p>
                      </div>
                      <span className={`text-[11px] font-medium ${urgencyColor(urgency)}`}>
                        {urgency}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Mini Calendar */}
          <div className="glass-surface rounded-2xl p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-zinc-200 uppercase tracking-wider">
                {format(now, 'MMMM')}
              </h2>
              <Button variant="ghost" size="sm" onClick={() => setActiveTab('calendar')}>
                <Calendar className="w-4 h-4" />
              </Button>
            </div>
            <div className="grid grid-cols-7 gap-0.5">
              {['Su','Mo','Tu','We','Th','Fr','Sa'].map((name) => (
                <div key={name} className="text-center text-[10px] text-zinc-600 py-1 font-medium">
                  {name}
                </div>
              ))}
              {miniDays.map((day, i) => {
                const key = format(day, 'yyyy-MM-dd');
                const count = eventsByDay.get(key) || 0;
                const active = isToday(day);
                const inMonth = isSameMonth(day, now);
                return (
                  <button
                    key={key}
                    onClick={() => setActiveTab('calendar')}
                    className={`text-[11px] w-full aspect-square flex items-center justify-center rounded relative
                      transition-colors hover:bg-zinc-800/50
                      ${!inMonth ? 'text-zinc-700' : 'text-zinc-400'}
                      ${active ? 'bg-brand-100 text-brand-900 font-bold' : ''}`}
                  >
                    {format(day, 'd')}
                    {count > 0 && !active && (
                      <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-brand-400" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Friends & Spaces row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
          {/* Friends panel */}
          <div className="glass-surface rounded-2xl p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-zinc-400" />
                <h2 className="text-sm font-semibold text-zinc-200 uppercase tracking-wider">
                  Friends
                </h2>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setActiveTab('friends')}>
                Manage <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            </div>
            <p className="text-sm text-zinc-500">
              Manage your friend connections, accept pending requests, and organize relationships.
            </p>
          </div>

          {/* Spaces panel */}
          <div className="glass-surface rounded-2xl p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-zinc-400" />
                <h2 className="text-sm font-semibold text-zinc-200 uppercase tracking-wider">
                  Shared Spaces
                </h2>
              </div>
            </div>
            {spacesList.length === 0 ? (
              <div className="text-center py-4">
                <p className="text-sm text-zinc-500 mb-2">No shared spaces yet</p>
                <Button size="sm" onClick={() => setActiveTab('friends')}>
                  <Plus className="w-4 h-4" />
                  Create / Join a Space
                </Button>
              </div>
            ) : (
              <div className="flex flex-col gap-1.5">
                {spacesList.slice(0, 4).map((space) => (
                  <button
                    key={space.id}
                    onClick={() => setCurrentSpace(space)}
                    className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-zinc-800/50 transition-colors text-left"
                  >
                    <span className={`w-2 h-2 rounded-full shrink-0 ${spaceDotColors[space.type] || 'bg-zinc-500'}`} />
                    <span className="text-sm text-zinc-300 truncate">
                      {space.name || space.type.replace('_', ' ')}
                    </span>
                  </button>
                ))}
                {spacesList.length > 4 && (
                  <p className="text-xs text-zinc-600 px-3">
                    +{spacesList.length - 4} more
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
