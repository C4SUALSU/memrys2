import { useState, useEffect, useCallback, useMemo } from 'react';
import { useLocation } from 'react-router';
import {
  Calendar as CalendarIcon, Sparkles, AlertCircle, MessageSquare,
  Settings, Trash2, Save, X, Users,
} from 'lucide-react';
import { BrainDumpInput } from './BrainDumpInput';
import { PendingApprovals } from './PendingApprovals';
import { CalendarView } from './CalendarView';
import { SpaceManagement } from './SpaceManagement';
import { Spinner } from './ui/Spinner';
import { Modal } from './ui/Modal';
import { Input } from './ui/Input';
import { Button } from './ui/Button';
import { useBrainDump } from '@/hooks/useBrainDump';
import { useCalendarEvents } from '@/hooks/useCalendarEvents';
import { useModelConfigs } from '@/hooks/useModelConfigs';
import { useTimezone } from '@/hooks/useTimezone';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { useTimeTree } from '@/context/TimeTreeContext';
import { supabase, PROVIDER_TOKEN_KEY } from '@/lib/supabase';
import type { Space, ParsedEventPayload, CalendarEvent } from '@/types/app';

type Tab = 'brain-dump' | 'calendar';

interface CalendarWorkspaceProps {
  currentSpace: Space | null;
}

export function CalendarWorkspace({ currentSpace }: CalendarWorkspaceProps) {
  const location = useLocation();
  const forwardedText = (location.state as { forwardedText?: string })?.forwardedText ?? '';
  const forwardedSpaceId = (location.state as { spaceId?: string })?.spaceId ?? null;

  const [activeTab, setActiveTab] = useState<Tab>(forwardedText ? 'brain-dump' : 'calendar');
  const [brainDumpText, setBrainDumpText] = useState(forwardedText);
  const { results, isProcessing, error, parse, acceptEvent, reset } = useBrainDump();
  const { events: calendarEvents, createEvent, updateEvent, deleteEvent, fetchEvents } = useCalendarEvents(currentSpace?.id ?? null);
  const { profile, user, session } = useAuth();
  const { configs, getGlobalKey, getDecryptedKey } = useModelConfigs();
  const { setActiveTab: setGlobalTab, refreshSpaces } = useTimeTree();
  const toast = useToast();

  const [googleEvents, setGoogleEvents] = useState<CalendarEvent[]>([]);
  const [googleSyncLoading, setGoogleSyncLoading] = useState(false);

  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [savingRename, setSavingRename] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingSpace, setDeletingSpace] = useState(false);
  const [showSpaceManagement, setShowSpaceManagement] = useState(false);

  const isSpaceOwner = currentSpace?.created_by === user?.id;

  useEffect(() => {
    let cancelled = false;

    const fetchGoogleEvents = async () => {
      const providerToken = session?.provider_token || localStorage.getItem(PROVIDER_TOKEN_KEY);
      if (!providerToken || !user) return;

      setGoogleSyncLoading(true);
      try {
        const now = new Date().toISOString();
        const response = await fetch(
          `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${encodeURIComponent(now)}&maxResults=50&singleEvents=true&orderBy=startTime`,
          {
            headers: { Authorization: `Bearer ${providerToken}` },
          }
        );

        if (!response.ok) {
          if (response.status === 401) {
            console.warn('Google Calendar token expired or invalid');
          }
          return;
        }

        const json = await response.json();

        if (!cancelled) {
          const transformed: CalendarEvent[] = (json.items || []).map((item: Record<string, unknown>) => {
            const start = (item.start as Record<string, string>) || {};
            const end = (item.end as Record<string, string>) || {};
            return {
              id: item.id as string,
              space_id: null,
              title: (item.summary as string) || 'Untitled',
              description: (item.description as string) || '',
              start_time: start.dateTime || start.date || '',
              end_time: end.dateTime || end.date || '',
              is_all_day: !start.dateTime,
              metadata: { source: 'google_calendar', google_event_id: item.id },
              created_by: user.id,
              created_at: (item.created as string) || now,
            };
          });
          setGoogleEvents(transformed);
        }
      } catch (err) {
        console.error('Failed to fetch Google Calendar events:', err);
      } finally {
        if (!cancelled) setGoogleSyncLoading(false);
      }
    };

    fetchGoogleEvents();

    return () => { cancelled = true; };
  }, [session?.provider_token, user, currentSpace]);

  const mergedEvents = useMemo(() => {
    const seen = new Set(calendarEvents.map((e) => e.id));
    const filtered = googleEvents.filter((ge) => !seen.has(ge.id));
    return [...calendarEvents, ...filtered];
  }, [calendarEvents, googleEvents]);

  useEffect(() => {
    if (forwardedText) {
      setBrainDumpText(forwardedText);
      setActiveTab('brain-dump');
      window.history.replaceState({}, document.title);
    }
  }, [forwardedText]);

  const handleParse = async (modelConfigId?: string) => {
    let apiKey: string | undefined;

    if (modelConfigId) {
      const key = await getDecryptedKey(modelConfigId);
      if (key) apiKey = key;
      else toast.warning('Selected model key unavailable');
    }

    if (!apiKey) {
      const globalConfig = getGlobalKey();
      if (globalConfig) {
        const key = await getDecryptedKey(globalConfig.id);
        if (key) apiKey = key;
      }
    }

    if (!apiKey) {
      const fallback = configs.find((c) => c.vault_key_id);
      if (fallback) {
        const key = await getDecryptedKey(fallback.id);
        if (key) apiKey = key;
      }
    }

    await parse(brainDumpText, profile?.timezone ?? 'UTC', modelConfigId, apiKey);
  };

  const handleReset = () => {
    setBrainDumpText('');
    reset();
  };

  const handleAccept = async (event: ParsedEventPayload, tag: string, startTimeOverride?: string, endTimeOverride?: string) => {
    const result = await acceptEvent(event, currentSpace?.id ?? null, tag, startTimeOverride, endTimeOverride);
    if (!result.error) {
      toast.success(`"${event.title}" added to ${tag} events`);
      fetchEvents();
    }
  };

  const handleReject = (event: ParsedEventPayload) => {
    reset();
    toast.info('Event dismissed');
  };

  const handleAddEvent = useCallback(async (eventData: {
    title: string;
    description: string;
    startTime: string;
    endTime: string;
    isAllDay: boolean;
    spaceId: string | null;
  }) => {
    if (!user) return { error: 'Not authenticated' };
    const result = await createEvent({
      title: eventData.title,
      description: eventData.description,
      start_time: eventData.startTime,
      end_time: eventData.endTime,
      is_all_day: eventData.isAllDay,
      space_id: eventData.spaceId ?? currentSpace?.id ?? null,
      created_by: user.id,
    });
    return { error: result.error };
  }, [user, createEvent, currentSpace]);

  const handleUpdateEvent = useCallback(async (eventId: string, eventData: {
    title: string;
    description: string;
    startTime: string;
    endTime: string;
    isAllDay: boolean;
    spaceId: string | null;
  }) => {
    const result = await updateEvent(eventId, {
      title: eventData.title,
      description: eventData.description,
      start_time: eventData.startTime,
      end_time: eventData.endTime,
      is_all_day: eventData.isAllDay,
      space_id: eventData.spaceId ?? currentSpace?.id ?? null,
    });
    return { error: result.error };
  }, [updateEvent, currentSpace]);

  const handleDeleteEvent = useCallback(async (eventId: string) => {
    const result = await deleteEvent(eventId);
    if (result.error) toast.error(result.error);
    else toast.info('Event deleted');
  }, [deleteEvent, toast]);

  const handleStartRename = () => {
    setRenameValue(currentSpace?.name ?? '');
    setRenaming(true);
  };

  const handleSaveRename = async () => {
    if (!currentSpace) return;
    setSavingRename(true);
    const { error } = await supabase
      .from('spaces')
      .update({ name: renameValue.trim() || null })
      .eq('id', currentSpace.id);
    setSavingRename(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success('Space renamed');
      setRenaming(false);
      await refreshSpaces();
    }
  };

  const handleCancelRename = () => {
    setRenaming(false);
    setRenameValue('');
  };

  const handleDeleteSpace = async () => {
    if (!currentSpace) return;
    setDeletingSpace(true);
    const { error } = await supabase
      .from('spaces')
      .delete()
      .eq('id', currentSpace.id);
    setDeletingSpace(false);
    setShowDeleteConfirm(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success('Calendar deleted');
      await refreshSpaces();
    }
  };

  const spaceTypeLabels: Record<string, string> = {
    direct_partner: 'Partner Calendar',
    group_chat: 'Group Calendar',
    family_circle: 'Family Calendar',
  };

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-5xl mx-auto px-4 py-8 lg:px-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-brand-900/50 border border-brand-800/50 flex items-center justify-center">
            <CalendarIcon className="w-5 h-5 text-brand-300" />
          </div>
          <div className="flex-1 min-w-0">
            {renaming ? (
              <div className="flex items-center gap-2">
                <Input
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  placeholder="Space name"
                  className="max-w-xs"
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSaveRename(); if (e.key === 'Escape') handleCancelRename(); }}
                  autoFocus
                />
                <Button size="sm" onClick={handleSaveRename} loading={savingRename}>
                  <Save className="w-3.5 h-3.5" />
                </Button>
                <Button size="sm" variant="ghost" onClick={handleCancelRename}>
                  <X className="w-3.5 h-3.5" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-semibold text-zinc-100">
                  {currentSpace
                    ? currentSpace.name || spaceTypeLabels[currentSpace.type] || 'Space Calendar'
                    : 'Personal Calendar'}
                </h1>
                {currentSpace && (
                  <button
                    onClick={handleStartRename}
                    className="text-zinc-600 hover:text-zinc-300 transition-colors"
                    title="Rename space"
                  >
                    <Settings className="w-4 h-4" />
                  </button>
                )}
              </div>
            )}
            <p className="text-sm text-zinc-500">
              {currentSpace
                ? `${currentSpace.type.replace('_', ' ')} — brain dump or manually schedule events`
                : 'Brain dump or manually schedule your events'}
            </p>
          </div>
          {currentSpace && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowSpaceManagement(true)}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-zinc-400
                           hover:text-zinc-200 hover:bg-zinc-800/50 transition-colors border border-zinc-800/50"
                title="Manage members"
              >
                <Users className="w-4 h-4" />
                Members
              </button>
              <button
                onClick={() => setGlobalTab('chat', currentSpace.id)}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-zinc-400
                           hover:text-zinc-200 hover:bg-zinc-800/50 transition-colors border border-zinc-800/50"
              >
                <MessageSquare className="w-4 h-4" />
                Chat
              </button>
              {isSpaceOwner && (
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-red-400
                             hover:text-red-300 hover:bg-red-950/30 transition-colors border border-red-900/30"
                  title="Delete calendar"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 p-1 rounded-xl bg-zinc-900 border border-zinc-800/50 w-fit">
          <button
            onClick={() => setActiveTab('brain-dump')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200
              ${activeTab === 'brain-dump'
                ? 'bg-zinc-800 text-zinc-100 shadow-sm'
                : 'text-zinc-500 hover:text-zinc-300'
              }`}
          >
            <Sparkles className="w-4 h-4" />
            Brain Dump
          </button>
          <button
            onClick={() => setActiveTab('calendar')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200
              ${activeTab === 'calendar'
                ? 'bg-zinc-800 text-zinc-100 shadow-sm'
                : 'text-zinc-500 hover:text-zinc-300'
              }`}
          >
            <CalendarIcon className="w-4 h-4" />
            Calendar View
          </button>
        </div>

        {activeTab === 'brain-dump' && (
          <div className="flex flex-col gap-6">
            <div className="glass-surface rounded-2xl p-5">
              <BrainDumpInput
                text={brainDumpText}
                onTextChange={setBrainDumpText}
                onParse={handleParse}
                onReset={handleReset}
                isProcessing={isProcessing}
              />
            </div>

            {error && (
              <div className="glass-surface rounded-2xl p-4 border-red-800/50 bg-red-950/20">
                <p className="text-sm text-red-400">{error}</p>
                <p className="text-xs text-red-500/70 mt-1">
                  Try shortening your input or resetting the parser session.
                </p>
              </div>
            )}

            {isProcessing && <Spinner />}

            <PendingApprovals
              events={results}
              onAccept={handleAccept}
              onReject={handleReject}
              isProcessing={isProcessing}
            />
          </div>
        )}

        {activeTab === 'calendar' && (
          <>
            {session?.provider_token && (
              <div className="flex items-center gap-2 mb-3">
                <span className={`text-xs px-2 py-0.5 rounded-full border ${googleSyncLoading ? 'badge text-zinc-400 border-zinc-700' : 'badge-success text-emerald-400 border-emerald-800/30'}`}>
                  {googleSyncLoading ? 'Syncing Google Calendar...' : `Google Calendar — ${googleEvents.length} events synced`}
                </span>
              </div>
            )}
            <CalendarView
              events={mergedEvents}
              spaceId={currentSpace?.id ?? null}
              onAddEvent={handleAddEvent}
              onUpdateEvent={handleUpdateEvent}
              onDeleteEvent={handleDeleteEvent}
            />
          </>
        )}
      </div>

      {/* Delete space confirmation modal */}
      <Modal open={showDeleteConfirm} onClose={() => setShowDeleteConfirm(false)} title="Delete Calendar">
        <div className="flex flex-col gap-4">
          <div className="flex items-start gap-3 p-3 rounded-lg bg-red-950/30 border border-red-900/30">
            <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <div className="text-sm text-zinc-300">
              <p className="font-medium text-red-300 mb-1">This will permanently delete this shared calendar</p>
              <p className="text-zinc-400">
                All events, messages, and member data for this space will be removed.
                This action cannot be undone.
              </p>
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="ghost" onClick={() => setShowDeleteConfirm(false)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleDeleteSpace} loading={deletingSpace}>
              <Trash2 className="w-4 h-4" />
              Delete Calendar
            </Button>
          </div>
        </div>
      </Modal>

      {/* Space member management modal */}
      {showSpaceManagement && currentSpace && (
        <SpaceManagement
          space={currentSpace}
          open={showSpaceManagement}
          onClose={() => setShowSpaceManagement(false)}
        />
      )}
    </div>
  );
}
