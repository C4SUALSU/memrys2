import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { EventAttendee } from '@/types/app';

export function useEventAttendees(eventId: string | undefined) {
  const [attendees, setAttendees] = useState<EventAttendee[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchAttendees = useCallback(async () => {
    if (!eventId) { setAttendees([]); return; }
    setLoading(true);
    const { data, error } = await supabase
      .from('calendar_event_attendees')
      .select('*')
      .eq('event_id', eventId);
    if (!error && data) setAttendees(data as EventAttendee[]);
    setLoading(false);
  }, [eventId]);

  useEffect(() => { fetchAttendees(); }, [fetchAttendees]);

  const confirmAttendance = useCallback(async (userId: string, status: 'confirmed' | 'pending' | 'rejected') => {
    if (!eventId) return { error: 'No event selected' };
    const { error } = await supabase
      .from('calendar_event_attendees')
      .upsert({ event_id: eventId, user_id: userId, status, updated_at: new Date().toISOString() })
      .select()
      .single();

    if (!error) await fetchAttendees();
    return { error: error?.message ?? null };
  }, [eventId, fetchAttendees]);

  const getUserAttendees = useCallback(async (userId: string) => {
    const { data } = await supabase
      .from('calendar_event_attendees')
      .select('*')
      .eq('user_id', userId);
    return data as EventAttendee[] | null;
  }, []);

  const getPendingAttendeesForUser = useCallback(async (userId: string) => {
    const { data } = await supabase
      .from('calendar_event_attendees')
      .select('*, calendar_events(*)')
      .eq('user_id', userId)
      .eq('status', 'pending');
    return data ?? [];
  }, []);

  return { attendees, loading, fetchAttendees, confirmAttendance, getUserAttendees, getPendingAttendeesForUser };
}
