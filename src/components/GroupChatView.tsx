import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { Send, ArrowDown, MessageSquare, ArrowLeft, Calendar } from 'lucide-react';
import { ChatMessageCell } from './ChatMessageCell';
import { BatchActionBar } from './BatchActionBar';
import { Button } from './ui/Button';
import { EmptyState } from './ui/EmptyState';
import { Spinner } from './ui/Spinner';
import { useChat } from '@/hooks/useChat';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { useTimeTree } from '@/context/TimeTreeContext';
import type { Space } from '@/types/app';

interface GroupChatViewProps {
  currentSpace: Space;
}

export function GroupChatView({ currentSpace }: GroupChatViewProps) {
  const spaceId = currentSpace.id;
  const { user } = useAuth();
  const { messages, loading, sendMessage } = useChat(spaceId);
  const { setActiveTab } = useTimeTree();
  const toast = useToast();
  const navigate = useNavigate();

  const [newMessage, setNewMessage] = useState('');
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    if (autoScroll) scrollToBottom();
  }, [messages, autoScroll, scrollToBottom]);

  const handleScroll = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const isAtBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 100;
    setAutoScroll(isAtBottom);
  }, []);

  const handleSend = async () => {
    if (!newMessage.trim() || !user) return;
    setSending(true);
    const result = await sendMessage(newMessage.trim(), user.id);
    setSending(false);
    if (result.error) {
      toast.error(result.error);
    } else {
      setNewMessage('');
      setAutoScroll(true);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleLongPress = useCallback((_id: string) => {
    if (!isSelectionMode) {
      setIsSelectionMode(true);
    }
  }, [isSelectionMode]);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        if (next.size === 0) setIsSelectionMode(false);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const handleForwardToParser = useCallback(() => {
    const selectedMessages = messages
      .filter((m) => selectedIds.has(m.id))
      .map((m) => `${m.sender_display_name ?? 'User'}: ${m.message_text}`);

    const concatenated = selectedMessages.join('\n');

    setIsSelectionMode(false);
    setSelectedIds(new Set());

    navigate('/app?tab=calendar', { state: { forwardedText: concatenated, spaceId } });
  }, [messages, selectedIds, navigate, spaceId]);

  const handleCancelSelection = useCallback(() => {
    setIsSelectionMode(false);
    setSelectedIds(new Set());
  }, []);

  const spaceDisplayName = currentSpace.name || currentSpace.type.replace('_', ' ');

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Chat header */}
      <div className="glass-surface border-b border-zinc-800/50 px-4 py-3 flex items-center gap-3 shrink-0">
        <button
          onClick={() => setActiveTab('calendar', currentSpace.id)}
          className="text-zinc-400 hover:text-zinc-200 transition-colors"
          title="Back to Calendar"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-zinc-200 truncate">{spaceDisplayName}</p>
          <p className="text-xs text-zinc-500">Group Chat</p>
        </div>
        <button
          onClick={() => setActiveTab('calendar', currentSpace.id)}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-zinc-400
                     hover:text-zinc-200 hover:bg-zinc-800/50 transition-colors"
        >
          <Calendar className="w-3.5 h-3.5" />
          Calendar
        </button>
      </div>

      {/* Messages */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto"
      >
        {loading ? (
          <Spinner />
        ) : messages.length === 0 ? (
          <div className="flex-1 flex items-center justify-center h-full">
            <EmptyState icon="💬" title="No messages yet" description="Be the first to say something in this space" />
          </div>
        ) : (
          <div className="flex flex-col">
            {messages.map((msg) => (
              <ChatMessageCell
                key={msg.id}
                message={msg}
                isSelectionMode={isSelectionMode}
                isSelected={selectedIds.has(msg.id)}
                onToggleSelect={toggleSelect}
                onLongPress={handleLongPress}
                isOwnMessage={msg.sender_id === user?.id}
              />
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Scroll-to-bottom button */}
      {!autoScroll && messages.length > 0 && (
        <button
          onClick={() => { scrollToBottom(); setAutoScroll(true); }}
          className="absolute bottom-24 right-6 w-10 h-10 rounded-full bg-zinc-800 border border-zinc-700
                     flex items-center justify-center shadow-lg hover:bg-zinc-700 transition-colors z-10"
        >
          <ArrowDown className="w-4 h-4 text-zinc-300" />
        </button>
      )}

      {/* Batch action bar */}
      {isSelectionMode && (
        <BatchActionBar
          selectedCount={selectedIds.size}
          onForward={handleForwardToParser}
          onCancel={handleCancelSelection}
        />
      )}

      {/* Chat input */}
      {!isSelectionMode && (
        <div className="glass-surface border-t border-zinc-800/50 px-4 py-3">
          <div className="flex items-end gap-2">
            <textarea
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a message..."
              rows={1}
              className="input-field resize-none min-h-[44px] max-h-[120px] py-2.5"
            />
            <Button onClick={handleSend} loading={sending} disabled={!newMessage.trim()} size="sm" className="shrink-0 h-[44px]">
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
