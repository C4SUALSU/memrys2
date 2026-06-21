import { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router';
import { Brain, Calendar as CalendarIcon, Sparkles, AlertCircle, MessageSquare } from 'lucide-react';
import { BrainDumpInput } from './BrainDumpInput';
import { PendingApprovals } from './PendingApprovals';
import { CalendarView } from './CalendarView';
import { Spinner } from './ui/Spinner';
import { useBrainDump } from '@/hooks/useBrainDump';
import { useCalendarEvents } from '@/hooks/useCalendarEvents';
import { useModelConfigs } from '@/hooks/useModelConfigs';
import { useTimezone } from '@/hooks/useTimezone';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { useTimeTree } from '@/context/TimeTreeContext';
import type { Space, ParsedEventPayload } from '@/types/app';

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
  const { events: calendarEvents, createEvent, updateEvent, fetchEvents } = useCalendarEvents(currentSpace?.id ?? null);
  const { profile, user } = useAuth();
  const { configs, getGlobalKey, getDecryptedKey } = useModelConfigs();
  const { setActiveTab: setGlobalTab } = useTimeTree();
  const toast = useToast();

  useEffect(() => {
    if (forwardedText) {
      setBrainDumpText(forwardedText);
      setActiveTab('brain-dump');
      window.history.replaceState({}, document.title);
    }
  }, [forwardedText]);

  const handleParse = async (modelConfigId?: string) => {
    let apiKey: string | undefined;

    // Priority 1: a custom model was selected in the dropdown → fetch its key
    if (modelConfigId) {
      const key = await getDecryptedKey(modelConfigId);
      if (key) apiKey = key;
      else toast.warning('Selected model key unavailable');
    }

    // Priority 2: no key yet → try the global OpenRouter key
    if (!apiKey) {
      const globalConfig = getGlobalKey();
      if (globalConfig) {
        const key = await getDecryptedKey(globalConfig.id);
        if (key) apiKey = key;
      }
    }

    // Priority 3: any other saved key as fallback
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
            <h1 className="text-xl font-semibold text-zinc-100">
              {currentSpace
                ? currentSpace.name || spaceTypeLabels[currentSpace.type] || 'Space Calendar'
                : 'Personal Calendar'}
            </h1>
            <p className="text-sm text-zinc-500">
              {currentSpace
                ? `${currentSpace.type.replace('_', ' ')} — brain dump or manually schedule events`
                : 'Brain dump or manually schedule your events'}
            </p>
          </div>
          {currentSpace && (
            <button
              onClick={() => setGlobalTab('chat', currentSpace.id)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-zinc-400
                         hover:text-zinc-200 hover:bg-zinc-800/50 transition-colors border border-zinc-800/50"
            >
              <MessageSquare className="w-4 h-4" />
              Chat
            </button>
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
          <CalendarView
            events={calendarEvents}
            spaceId={currentSpace?.id ?? null}
            onAddEvent={handleAddEvent}
            onUpdateEvent={handleUpdateEvent}
          />
        )}
      </div>
    </div>
  );
}
