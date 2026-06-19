import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { ChatMessage, ChatMessageWithSender } from '@/types/app';

export function useChat(spaceId: string | undefined) {
  const [messages, setMessages] = useState<ChatMessageWithSender[]>([]);
  const [loading, setLoading] = useState(true);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const fetchMessages = useCallback(async () => {
    if (!spaceId) { setMessages([]); setLoading(false); return; }
    setLoading(true);
    const { data, error } = await supabase
      .from('chat_messages')
      .select('*, profiles:sender_id(display_name, avatar_url)')
      .eq('space_id', spaceId)
      .order('created_at', { ascending: true })
      .limit(100);

    if (!error && data) {
      setMessages(
        data.map((msg: Record<string, unknown>) => {
          const sender = msg.profiles as { display_name?: string; avatar_url?: string | null } | null;
          return {
            ...msg,
            sender_display_name: sender?.display_name,
            sender_avatar_url: sender?.avatar_url,
          } as ChatMessageWithSender;
        })
      );
    }
    setLoading(false);
  }, [spaceId]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  useEffect(() => {
    if (!spaceId) return;

    const channel = supabase
      .channel(`chat:${spaceId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `space_id=eq.${spaceId}` },
        (payload) => {
          const msg = payload.new as ChatMessage;
          supabase
            .from('profiles')
            .select('display_name, avatar_url')
            .eq('id', msg.sender_id)
            .single()
            .then(({ data: profile }) => {
              setMessages((prev) => [
                ...prev,
                {
                  ...msg,
                  sender_display_name: profile?.display_name,
                  sender_avatar_url: profile?.avatar_url,
                },
              ]);
            });
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
    };
  }, [spaceId]);

  const sendMessage = useCallback(async (messageText: string, senderId: string) => {
    if (!spaceId) return { error: 'No space selected' };
    const { error } = await supabase
      .from('chat_messages')
      .insert({ space_id: spaceId, sender_id: senderId, message_text: messageText });
    return { error: error?.message ?? null };
  }, [spaceId]);

  return { messages, loading, sendMessage, fetchMessages };
}
