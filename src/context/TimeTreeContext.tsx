import { createContext, useContext, useEffect, useState, useCallback, useMemo, type ReactNode } from 'react';
import { useSearchParams, useLocation } from 'react-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import type { Space } from '@/types/app';

export type ActiveTab = 'calendar' | 'chat' | 'friends' | 'settings' | 'dashboard';

interface TimeTreeState {
  activeTab: ActiveTab;
  currentSpace: Space | null;
  spacesList: Space[];
  spacesLoading: boolean;
  setActiveTab: (tab: ActiveTab, spaceId?: string | null) => void;
  setCurrentSpace: (space: Space | null) => void;
  refreshSpaces: () => Promise<void>;
}

const TimeTreeContext = createContext<TimeTreeState | undefined>(undefined);

function tabFromParam(raw: string | null): ActiveTab {
  if (raw === 'calendar') return 'calendar';
  if (raw === 'chat') return 'chat';
  if (raw === 'friends') return 'friends';
  if (raw === 'settings') return 'settings';
  return 'dashboard';
}

export function TimeTreeProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();

  const [spacesList, setSpacesList] = useState<Space[]>([]);
  const [spacesLoading, setSpacesLoading] = useState(true);
  const [currentSpace, setCurrentSpace] = useState<Space | null>(null);

  const activeTab = useMemo((): ActiveTab => {
    return tabFromParam(searchParams.get('tab'));
  }, [searchParams]);

  const fetchSpaces = useCallback(async () => {
    if (!user) {
      setSpacesList([]);
      setSpacesLoading(false);
      return;
    }
    setSpacesLoading(true);

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
    if (!error && data) {
      setSpacesList(data as Space[]);
    }
    setSpacesLoading(false);
  }, [user]);

  useEffect(() => {
    fetchSpaces();
  }, [fetchSpaces]);

  useEffect(() => {
    const spaceIdParam = searchParams.get('space');
    if (spaceIdParam) {
      const match = spacesList.find(s => s.id === spaceIdParam);
      if (match && match.id !== currentSpace?.id) {
        setCurrentSpace(match);
      } else if (!match && currentSpace) {
        setCurrentSpace(null);
      }
    } else if (currentSpace !== null) {
      setCurrentSpace(null);
    }
  }, [searchParams, spacesList, currentSpace]);

  const setActiveTab = useCallback((tab: ActiveTab, spaceId?: string | null) => {
    const params = new URLSearchParams(searchParams);
    params.set('tab', tab);
    if (spaceId) {
      params.set('space', spaceId);
    } else if (spaceId === null) {
      params.delete('space');
    }
    setSearchParams(params, { replace: true });
  }, [searchParams, setSearchParams]);

  const setCurrentSpaceDirect = useCallback((space: Space | null) => {
    if (space) {
      setActiveTab('calendar', space.id);
    } else {
      setActiveTab('calendar', null);
    }
  }, [setActiveTab]);

  const refreshSpaces = useCallback(async () => {
    await fetchSpaces();
  }, [fetchSpaces]);

  return (
    <TimeTreeContext.Provider
      value={{
        activeTab,
        currentSpace,
        spacesList,
        spacesLoading,
        setActiveTab,
        setCurrentSpace: setCurrentSpaceDirect,
        refreshSpaces,
      }}
    >
      {children}
    </TimeTreeContext.Provider>
  );
}

export function useTimeTree(): TimeTreeState {
  const ctx = useContext(TimeTreeContext);
  if (!ctx) throw new Error('useTimeTree must be used within TimeTreeProvider');
  return ctx;
}
