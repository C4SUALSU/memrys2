import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { Space } from '@/types/app';

export function useSpaces() {
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSpaces = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.from('spaces').select('*').order('created_at', { ascending: false });
    if (!error && data) setSpaces(data);
    setLoading(false);
  }, []);

  useEffect(() => { fetchSpaces(); }, [fetchSpaces]);

  const createSpace = useCallback(async (name: string | null, type: Space['type'], createdBy: string) => {
    const { data, error } = await supabase
      .from('spaces')
      .insert({ name, type, created_by: createdBy })
      .select()
      .single();

    if (error) return { error: error.message, data: null };
    setSpaces((prev) => [data, ...prev]);
    return { error: null, data };
  }, []);

  return { spaces, loading, fetchSpaces, createSpace };
}
