import { useCallback, useRef, useState } from 'react';
import { Checkbox } from './ui/Checkbox';
import { useTimezone } from '@/hooks/useTimezone';
import type { ChatMessageWithSender } from '@/types/app';

interface ChatMessageCellProps {
  message: ChatMessageWithSender;
  isSelectionMode: boolean;
  isSelected: boolean;
  onToggleSelect: (id: string) => void;
  onLongPress: (id: string) => void;
  isOwnMessage: boolean;
}

export function ChatMessageCell({
  message,
  isSelectionMode,
  isSelected,
  onToggleSelect,
  onLongPress,
  isOwnMessage,
}: ChatMessageCellProps) {
  const { relativeTime } = useTimezone();
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [longPressActive, setLongPressActive] = useState(false);

  const startLongPress = useCallback(() => {
    if (isSelectionMode) return;
    setLongPressActive(true);
    longPressTimer.current = setTimeout(() => {
      onLongPress(message.id);
      setLongPressActive(false);
    }, 600);
  }, [isSelectionMode, message.id, onLongPress]);

  const cancelLongPress = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    setLongPressActive(false);
  }, []);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    if (!isSelectionMode) onLongPress(message.id);
  }, [isSelectionMode, message.id, onLongPress]);

  return (
    <div
      className={`group flex items-start gap-3 px-4 py-3 hover:bg-zinc-900/50 transition-colors
                  ${isSelected ? 'bg-brand-900/20 ring-1 ring-brand-700/30' : ''}
                  ${longPressActive ? 'bg-zinc-800/50' : ''}
                  cursor-pointer select-none`}
      onMouseDown={startLongPress}
      onMouseUp={cancelLongPress}
      onMouseLeave={cancelLongPress}
      onTouchStart={startLongPress}
      onTouchEnd={cancelLongPress}
      onContextMenu={handleContextMenu}
      onClick={() => { if (isSelectionMode) onToggleSelect(message.id); }}
    >
      {(isSelectionMode) && (
        <div className="pt-1">
          <Checkbox checked={isSelected} onChange={() => onToggleSelect(message.id)} />
        </div>
      )}

      <div className="w-8 h-8 rounded-full bg-zinc-700 flex items-center justify-center shrink-0">
        <span className="text-xs font-medium text-zinc-300">
          {message.sender_display_name?.[0]?.toUpperCase() ?? '?'}
        </span>
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 mb-0.5">
          <span className="text-sm font-medium text-zinc-300">
            {message.sender_display_name ?? 'Unknown'}
          </span>
          <span className="text-xs text-zinc-600">{relativeTime(message.created_at)}</span>
        </div>
        <p className="text-sm text-zinc-200 leading-relaxed whitespace-pre-wrap break-words">
          {message.message_text}
        </p>
      </div>
    </div>
  );
}
