import type { BrainDumpRequest, BrainDumpResponse } from '@/types/app';
import { EDGE_FUNCTION_URL } from './constants';
import { supabase } from './supabase';

export async function parseBrainDump(request: BrainDumpRequest): Promise<BrainDumpResponse> {
  const { data: { session } } = await supabase.auth.getSession();

  if (!session?.access_token) {
    return { events: [], error: 'Not authenticated' };
  }

  const response = await fetch(EDGE_FUNCTION_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    return {
      events: [],
      error: body.error || `Request failed with status ${response.status}`,
      reset_session: body.reset_session,
    };
  }

  return response.json();
}
