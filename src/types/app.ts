export type FriendStatus = 'pending' | 'accepted' | 'rejected' | 'blocked';

export type RelationshipLabel = 'partner' | 'family' | 'friend' | 'custom';
export type SpaceType = 'direct_partner' | 'group_chat' | 'family_circle';
export type ConfirmationStatus = 'confirmed' | 'pending' | 'rejected';
export type AIProvider = 'openai' | 'anthropic' | 'google' | 'openrouter';

export interface Profile {
  id: string;
  display_name: string;
  avatar_url: string | null;
  timezone: string;
  updated_at: string;
}

export interface Space {
  id: string;
  name: string | null;
  type: SpaceType;
  created_by: string;
  created_at: string;
}

export interface SpaceMember {
  id: string;
  space_id: string;
  user_id: string;
  joined_at: string;
  relationship_tag?: string;
}

export interface SpaceMemberWithProfile extends SpaceMember {
  display_name: string;
  avatar_url: string | null;
}

export interface ChatMessage {
  id: string;
  space_id: string;
  sender_id: string;
  message_text: string;
  created_at: string;
}

export interface CalendarEvent {
  id: string;
  space_id: string | null;
  title: string;
  description: string;
  start_time: string;
  end_time: string;
  is_all_day: boolean;
  metadata: Record<string, unknown>;
  created_by: string | null;
  created_at: string;
}

export interface UserCalendarEvent extends CalendarEvent {
  space_name?: string | null;
  space_type?: SpaceType | null;
  relationship_tag?: string;
}

export const RelationshipTagDisplay: Record<string, { label: string; color: string; dotColor: string }> = {
  Partner: { label: 'Partner', color: 'bg-rose-900/50 text-rose-300 border-rose-800/30', dotColor: 'bg-rose-400' },
  Family: { label: 'Family', color: 'bg-emerald-900/50 text-emerald-300 border-emerald-800/30', dotColor: 'bg-emerald-400' },
  Work: { label: 'Work', color: 'bg-slate-900/50 text-slate-300 border-slate-800/30', dotColor: 'bg-slate-400' },
  Friend: { label: 'Friend', color: 'bg-sky-900/50 text-sky-300 border-sky-800/30', dotColor: 'bg-sky-400' },
  Other: { label: 'Other', color: 'bg-violet-900/50 text-violet-300 border-violet-800/30', dotColor: 'bg-violet-400' },
  Personal: { label: 'Personal', color: 'bg-brand-900/50 text-brand-300 border-brand-800/30', dotColor: 'bg-brand-300' },
};

export interface EventAttendee {
  id: string;
  event_id: string;
  user_id: string;
  status: ConfirmationStatus;
  updated_at: string;
}

export interface UserModelConfig {
  id: string;
  user_id: string;
  provider: AIProvider;
  model_id: string;
  display_name: string | null;
  vault_key_id: string | null;
  is_default: boolean;
  created_at: string;
}

export interface ParsedEventPayload {
  title: string;
  description: string;
  start_time: string;
  end_time: string;
  is_all_day: boolean;
}

export interface BrainDumpRequest {
  text: string;
  user_timezone: string;
  current_reference_date: string;
  model_config_id?: string;
  api_key?: string;
}

export interface BrainDumpResponse {
  events: ParsedEventPayload[];
  warnings?: string[];
  error?: string;
  reset_session?: boolean;
}

export interface ParserSessionState {
  isProcessing: boolean;
  results: ParsedEventPayload[];
  error: string | null;
}

export interface AuditLogEntry {
  id: string;
  operation: string;
  table_name: string;
  record_id: string | null;
  user_id: string | null;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  created_at: string;
}

export interface ChatMessageWithSender extends ChatMessage {
  sender_display_name?: string;
  sender_avatar_url?: string | null;
}

export interface CalendarEventWithAttendees extends CalendarEvent {
  attendees?: EventAttendee[];
}

export interface DiagnosticErrorPayload {
  code: string;
  message: string;
  details?: string;
  hint?: string;
  table?: string;
  constraint?: string;
}

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  duration?: number;
  code?: string;
  details?: string;
  hint?: string;
}

export interface FriendConnection {
  id: string;
  requester_id: string;
  recipient_id: string;
  status: FriendStatus;
  relationship: RelationshipLabel;
  relationship_tag?: string;
  created_at: string;
  updated_at: string;
}

export interface FriendConnectionWithProfile extends FriendConnection {
  other_user_id: string;
  other_display_name: string;
  other_avatar_url: string | null;
}

export interface UserSearchResult {
  id: string;
  display_name: string;
  avatar_url: string | null;
}
