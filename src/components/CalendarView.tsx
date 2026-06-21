import { useState, useMemo } from 'react';
import {
  ChevronLeft, ChevronRight, Plus, Calendar as CalendarIcon,
  Clock, MapPin, ChevronDown, ChevronUp,
} from 'lucide-react';
import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, addMonths,
  format, isSameDay, isSameMonth, isToday, parseISO, isWithinInterval,
} from 'date-fns';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';
import { EventModal } from './EventModal';
import { useTimezone } from '@/hooks/useTimezone';
import { useToast } from '@/context/ToastContext';
import type { CalendarEvent } from '@/types/app';

interface CalendarViewProps {
  events: CalendarEvent[];
  spaceId: string | null;
  onAddEvent: (event: {
    title: string;
    description: string;
    startTime: string;
    endTime: string;
    isAllDay: boolean;
    spaceId: string | null;
  }) => Promise<{ error: string | null }>;
  onUpdateEvent?: (eventId: string, updates: {
    title: string;
    description: string;
    startTime: string;
    endTime: string;
    isAllDay: boolean;
    spaceId: string | null;
  }) => Promise<{ error: string | null }>;
}

export function CalendarView({ events, spaceId, onAddEvent, onUpdateEvent }: CalendarViewProps) {
  const { toLocal } = useTimezone();
  const [currentMonth, setCurrentMonth] = useState(startOfMonth(new Date()));
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showEventModal, setShowEventModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [expandedDay, setExpandedDay] = useState<string | null>(null);
  const toast = useToast();

  const prevMonth = () => setCurrentMonth((m) => startOfMonth(addMonths(m, -1)));
  const nextMonth = () => setCurrentMonth((m) => startOfMonth(addMonths(m, 1)));
  const goToday = () => setCurrentMonth(startOfMonth(new Date()));

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });

  const days = useMemo(() => {
    const result: Date[] = [];
    let day = calendarStart;
    while (day <= calendarEnd) {
      result.push(day);
      day = addDays(day, 1);
    }
    return result;
  }, [calendarStart, calendarEnd]);

  const getEventsForDay = (day: Date): CalendarEvent[] => {
    return events.filter((ev) => {
      const start = parseISO(ev.start_time);
      const end = parseISO(ev.end_time);
      if (ev.is_all_day) {
        const dayStart = new Date(day.getFullYear(), day.getMonth(), day.getDate());
        const dayEnd = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 23, 59, 59);
        return start <= dayEnd && end >= dayStart;
      }
      return isWithinInterval(day, { start: new Date(start.getFullYear(), start.getMonth(), start.getDate()), end: new Date(end.getFullYear(), end.getMonth(), end.getDate(), 23, 59, 59) });
    });
  };

  const selectedEvents = selectedDate ? getEventsForDay(selectedDate) : [];

  const weekDayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const handleDayClick = (day: Date) => {
    if (selectedDate && isSameDay(selectedDate, day)) {
      const key = day.toISOString();
      setExpandedDay(expandedDay === key ? null : key);
    } else {
      setSelectedDate(day);
      setExpandedDay(day.toISOString());
    }
  };

  const handleAddOnDay = (day: Date) => {
    setSelectedDate(day);
    setEditingEvent(null);
    setShowEventModal(true);
  };

  const handleEventClick = (e: React.MouseEvent, ev: CalendarEvent) => {
    e.stopPropagation();
    setSelectedDate(parseISO(ev.start_time));
    setEditingEvent(ev);
    setShowEventModal(true);
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={prevMonth}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <h3 className="text-base font-semibold text-zinc-200 min-w-[180px] text-center">
            {format(currentMonth, 'MMMM yyyy')}
          </h3>
          <Button variant="ghost" size="sm" onClick={nextMonth}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={goToday}>Today</Button>
          <Button size="sm" onClick={() => { setSelectedDate(new Date()); setShowEventModal(true); }}>
            <Plus className="w-4 h-4" />
            Add Event
          </Button>
        </div>
      </div>

      {/* Calendar grid */}
      <div className="glass-surface rounded-2xl overflow-hidden">
        {/* Weekday headers */}
        <div className="grid grid-cols-7 border-b border-zinc-800/50">
          {weekDayNames.map((name) => (
            <div key={name} className="py-2 text-center text-xs font-medium text-zinc-500 uppercase tracking-wider">
              {name}
            </div>
          ))}
        </div>

        {/* Days */}
        <div className="grid grid-cols-7">
          {days.map((day, idx) => {
            const dayEvents = getEventsForDay(day);
            const isCurrentMonth = isSameMonth(day, currentMonth);
            const isSelected = selectedDate && isSameDay(day, selectedDate);
            const isTodayDate = isToday(day);
            const dayKey = day.toISOString();

            return (
              <div
                key={dayKey}
                onClick={() => handleDayClick(day)}
                onDoubleClick={() => handleAddOnDay(day)}
                className={`
                  min-h-[80px] p-1.5 border-b border-r border-zinc-800/30 cursor-pointer
                  hover:bg-zinc-800/30 transition-colors relative group
                  ${!isCurrentMonth ? 'opacity-30' : ''}
                  ${isSelected ? 'bg-brand-900/20 ring-1 ring-brand-700/30' : ''}
                  ${idx % 7 === 6 ? 'border-r-0' : ''}
                `}
              >
                <div className="flex items-center justify-between mb-0.5">
                  <span className={`
                    text-xs w-6 h-6 flex items-center justify-center rounded-full
                    ${isTodayDate ? 'bg-brand-100 text-brand-900 font-bold' : 'text-zinc-400'}
                  `}>
                    {format(day, 'd')}
                  </span>
                  {isCurrentMonth && (
                    <button
                      onClick={(e) => { e.stopPropagation(); handleAddOnDay(day); }}
                      className="opacity-0 group-hover:opacity-100 transition-opacity text-zinc-500 hover:text-zinc-200"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  )}
                </div>
                <div className="flex flex-col gap-0.5">
                  {dayEvents.slice(0, isSelected ? 4 : 2).map((ev) => {
                    const tag = (ev.metadata as { tag?: string })?.tag || 'personal';
                    const tagColors: Record<string, string> = {
                      personal: 'bg-sky-900/50 text-sky-300 border-sky-800/30',
                      partner: 'bg-rose-900/50 text-rose-300 border-rose-800/30',
                      family: 'bg-emerald-900/50 text-emerald-300 border-emerald-800/30',
                      friend: 'bg-amber-900/50 text-amber-300 border-amber-800/30',
                    };
                    const color = tagColors[tag] || tagColors.personal;
                    return (
                      <div
                        key={ev.id}
                        onClick={(e) => handleEventClick(e, ev)}
                        className={`text-[10px] leading-tight px-1 py-0.5 rounded truncate border ${color} hover:opacity-80 transition-opacity cursor-pointer`}
                        title={ev.title}
                      >
                        {ev.is_all_day ? ev.title : `${toLocal(ev.start_time, 'h:mm a')} ${ev.title}`}
                      </div>
                    );
                  })}
                  {dayEvents.length > (isSelected ? 4 : 2) && (
                    <span className="text-[10px] text-zinc-600 pl-1">
                      +{dayEvents.length - (isSelected ? 4 : 2)} more
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Selected day detail */}
      {selectedDate && (
        <div className="glass-surface rounded-2xl p-4 animate-slide-down">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-semibold text-zinc-200">
              {format(selectedDate, 'EEEE, MMMM d, yyyy')}
            </h4>
            <Button size="sm" onClick={() => setShowEventModal(true)}>
              <Plus className="w-4 h-4" />
              Add Event
            </Button>
          </div>
          {selectedEvents.length === 0 ? (
            <p className="text-sm text-zinc-500 py-2">No events on this day</p>
          ) : (
            <div className="flex flex-col gap-2">
              {selectedEvents.map((ev) => {
                const tag = (ev.metadata as { tag?: string })?.tag || 'personal';
                const dotColors: Record<string, string> = {
                  personal: 'bg-sky-400',
                  partner: 'bg-rose-400',
                  family: 'bg-emerald-400',
                  friend: 'bg-amber-400',
                };
                const dotColor = dotColors[tag] || dotColors.personal;
                return (
                  <div
                    key={ev.id}
                    onClick={(e) => handleEventClick(e, ev)}
                    className="flex items-start gap-3 p-3 rounded-xl bg-zinc-800/40 border border-zinc-800/50 hover:bg-zinc-700/40 transition-colors cursor-pointer"
                  >
                    <div className={`w-2 h-2 rounded-full ${dotColor} mt-1.5 shrink-0`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-zinc-200">{ev.title}</p>
                      <p className="text-xs text-zinc-500">
                        <Clock className="w-3 h-3 inline mr-1" />
                        {ev.is_all_day ? 'All day' : `${toLocal(ev.start_time, 'h:mm a')} – ${toLocal(ev.end_time, 'h:mm a')}`}
                      </p>
                      {ev.description && (
                        <p className="text-xs text-zinc-600 mt-1 line-clamp-2">{ev.description}</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      <EventModal
        open={showEventModal}
        onClose={() => { setShowEventModal(false); setEditingEvent(null); }}
        onSave={onAddEvent}
        onUpdate={onUpdateEvent}
        eventToEdit={editingEvent}
        defaultDate={selectedDate || undefined}
      />
    </div>
  );
}
