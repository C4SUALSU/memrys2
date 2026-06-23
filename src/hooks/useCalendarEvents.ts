import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { CalendarEvent, UserCalendarEvent } from '@/types/app';

export function useCalendarEvents(spaceId?: string | null) {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchEvents = useCallback(async () => {
    setLoading(true);

    if (spaceId) {
      // Single-space view: query calendar_events directly
      const query = supabase
        .from('calendar_events')
        .select('*')
        .eq('space_id', spaceId)
        .order('start_time', { ascending: true });

      const { data, error } = await query;
      if (!error && data) setEvents(data as CalendarEvent[]);
    } else {
      // Personal / merged view: use user_calendar_view which RLS-filters
      const { data, error } = await supabase
        .from('user_calendar_view')
        .select('*')
        .order('start_time', { ascending: true });

      if (!error && data) {
        setEvents(data as unknown as CalendarEvent[]);
      }
    }

    setLoading(false);
  }, [spaceId]);

  useEffect(() => { fetchEvents(); }, [fetchEvents]);

  const createEvent = useCallback(async (event: {
    space_id?: string | null;
    title: string;
    description?: string;
    start_time: string;
    end_time: string;
    is_all_day?: boolean;
    metadata?: Record<string, unknown>;
    created_by: string;
  }) => {
    const { data, error } = await supabase
      .from('calendar_events')
      .insert(event)
      .select()
      .single();

    if (error) return { error: error.message, data: null };
    setEvents((prev) => [...prev, data as CalendarEvent]);
    return { error: null, data: data as CalendarEvent };
  }, []);

  const updateEvent = useCallback(async (id: string, updates: Partial<CalendarEvent>) => {
    const { error } = await supabase.from('calendar_events').update(updates).eq('id', id);
    if (!error) {
      setEvents((prev) => prev.map((ev) => (ev.id === id ? { ...ev, ...updates } : ev)));
    }
    return { error: error?.message ?? null };
  }, []);

  const deleteEvent = useCallback(async (id: string) => {
    const { error } = await supabase.from('calendar_events').delete().eq('id', id);
    if (!error) setEvents((prev) => prev.filter((ev) => ev.id !== id));
    return { error: error?.message ?? null };
  }, []);

  return { events, loading, fetchEvents, createEvent, updateEvent, deleteEvent };
}

export type { CalendarEvent, UserCalendarEvent };
