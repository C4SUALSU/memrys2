import { useCallback, useState } from 'react';
import { parseBrainDump } from '@/lib/ai-parser';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { supabase } from '@/lib/supabase';
import { HALLUCINATION_WINDOW_DAYS } from '@/lib/constants';
import type { ParsedEventPayload, BrainDumpResponse } from '@/types/app';

export function useBrainDump() {
  const { user } = useAuth();
  const toast = useToast();
  const [results, setResults] = useState<ParsedEventPayload[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastResponse, setLastResponse] = useState<BrainDumpResponse | null>(null);

  const parse = useCallback(async (
    text: string,
    timezone: string,
    modelConfigId?: string,
    apiKey?: string,
  ): Promise<BrainDumpResponse> => {
    if (!user) {
      const err = 'You must be signed in to parse brain dumps';
      toast.error(err);
      return { events: [], error: err };
    }

    if (!text.trim()) {
      const err = 'No text provided for parsing';
      toast.warning(err);
      return { events: [], error: err };
    }

    setIsProcessing(true);
    setError(null);

    const now = new Date();
    const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
    const refDate = `${now.toISOString().slice(0,10)} (${days[now.getUTCDay()]})`;

    const response = await parseBrainDump({
      text,
      user_timezone: timezone,
      current_reference_date: refDate,
      model_config_id: modelConfigId,
      api_key: apiKey,
    });

    setIsProcessing(false);
    setLastResponse(response);

    if (response.error) {
      setError(response.error);
      if (response.reset_session) {
        toast.warning('AI context limit reached. Try shorter input or reset the session.');
      } else {
        toast.error(response.error);
      }
      return response;
    }

    if (response.warnings?.length) {
      response.warnings.forEach((w) => toast.warning(w));
    }

    const processed = response.events.map((ev) => {
      const start = new Date(ev.start_time);
      const end = new Date(ev.end_time);
      if (!isNaN(start.getTime()) && !isNaN(end.getTime()) && (end.getTime() - start.getTime()) < 5 * 60 * 1000) {
        const oneHourLater = new Date(start.getTime() + 60 * 60 * 1000);
        return { ...ev, end_time: oneHourLater.toISOString() };
      }
      return ev;
    });
    setResults(processed);
    if (response.events.length === 0) {
      toast.info('No events found in your text. Try being more specific with dates and times.');
    } else {
      toast.success(`Found ${response.events.length} event${response.events.length > 1 ? 's' : ''} — review below`);
    }

    return response;
  }, [user, toast]);

  const validateEventDates = useCallback((events: ParsedEventPayload[]) => {
    const now = new Date();
    const maxDate = new Date(now.getTime() + HALLUCINATION_WINDOW_DAYS * 86400000);
    const minDate = new Date(now.getTime() - HALLUCINATION_WINDOW_DAYS * 86400000);

    return events.filter((ev) => {
      const start = new Date(ev.start_time);
      const end = new Date(ev.end_time);
      if (isNaN(start.getTime()) || isNaN(end.getTime())) return false;
      return start >= minDate && end <= maxDate;
    });
  }, []);

  const acceptEvent = useCallback(async (
    event: ParsedEventPayload,
    spaceId: string | null,
    tag?: string,
    startTimeOverride?: string,
    endTimeOverride?: string,
  ) => {
    if (!user) return { error: 'Not authenticated' };

    const { error } = await supabase.from('calendar_events').insert({
      title: event.title,
      description: event.description,
      start_time: startTimeOverride ?? event.start_time,
      end_time: endTimeOverride ?? event.end_time,
      is_all_day: event.is_all_day,
      space_id: spaceId,
      created_by: user.id,
      metadata: { source: 'brain_dump', tag: tag || 'personal' },
    });

    if (error) {
      toast.error(`Failed to save event: ${error.message}`);
      return { error: error.message };
    }

    setResults((prev) => prev.filter((r) => r.title !== event.title || r.start_time !== event.start_time));
    toast.success(`"${event.title}" added to your calendar`);
    return { error: null };
  }, [user, toast]);

  const reset = useCallback(() => {
    setResults([]);
    setError(null);
    setLastResponse(null);
  }, []);

  return { results, isProcessing, error, lastResponse, parse, acceptEvent, validateEventDates, reset };
}
