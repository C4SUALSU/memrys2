import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { CalendarEvent } from '@/types/app';

export function useCalendarEvents(spaceId?: string | null) {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    let query = supabase.from('calendar_events').select('*').order('start_time', { ascending: true });

    if (spaceId) {
      query = query.eq('space_id', spaceId);
    } else if (spaceId === null) {
      query = query.is('space_id', null);
    }

    const { data, error } = await query;
    if (!error && data) setEvents(data as CalendarEvent[]);
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
