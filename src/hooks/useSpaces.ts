import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import type { Space } from '@/types/app';

export function useSpaces() {
  const { user } = useAuth();
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSpaces = useCallback(async () => {
    if (!user) { setSpaces([]); setLoading(false); return; }
    setLoading(true);

    const { data: memberships } = await supabase
      .from('space_members')
      .select('space_id')
      .eq('user_id', user.id);

    const memberSpaceIds = memberships?.map(m => m.space_id) ?? [];

    let query = supabase
      .from('spaces')
      .select('*')
      .order('created_at', { ascending: false });

    if (memberSpaceIds.length > 0) {
      const idList = memberSpaceIds.map(id => `"${id}"`).join(',');
      query = query.or(`id.in.(${idList}),created_by.eq."${user.id}"`);
    } else {
      query = query.eq('created_by', user.id);
    }

    const { data, error } = await query;
    if (!error && data) setSpaces(data as Space[]);
    setLoading(false);
  }, [user]);

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
