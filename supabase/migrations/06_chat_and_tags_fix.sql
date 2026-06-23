-- Memrys v3.2 Chat RLS Fix & Relationship Tagging Migration
-- Date: 2026-06-24

-- ============================================================
-- 1. FIX CHAT MESSAGES RLS — explicit USING + WITH CHECK
-- ============================================================
DROP POLICY IF EXISTS "Allow members to interact with space chat" ON public.chat_messages;
DROP POLICY IF EXISTS "chat_messages_policy" ON public.chat_messages;

CREATE POLICY "Allow space members absolute chat access"
ON public.chat_messages
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.space_members
    WHERE space_members.space_id = chat_messages.space_id
    AND space_members.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.space_members
    WHERE space_members.space_id = chat_messages.space_id
    AND space_members.user_id = auth.uid()
  )
);

-- ============================================================
-- 2. REPLACE OLD tag COLUMN WITH relationship_tag
-- ============================================================

-- Drop the old tag column and its constraint
ALTER TABLE public.space_members
DROP CONSTRAINT IF EXISTS space_members_tag_check;

ALTER TABLE public.space_members
DROP COLUMN IF EXISTS tag;

-- Add new relationship_tag column
ALTER TABLE public.space_members
ADD COLUMN relationship_tag text NOT NULL DEFAULT 'Friend';

ALTER TABLE public.space_members
DROP CONSTRAINT IF EXISTS check_relationship_tag;

ALTER TABLE public.space_members
ADD CONSTRAINT check_relationship_tag
CHECK (relationship_tag IN ('Partner', 'Family', 'Friend', 'Work', 'Other'));

-- ============================================================
-- 3. RECREATE user_calendar_view WITH relationship_tag
-- ============================================================
DROP VIEW IF EXISTS public.user_calendar_view;

CREATE VIEW public.user_calendar_view
WITH (security_invoker = true)
AS
SELECT
    ce.id,
    ce.space_id,
    ce.title,
    ce.description,
    ce.start_time,
    ce.end_time,
    ce.is_all_day,
    ce.metadata,
    ce.created_by,
    ce.created_at,
    s.name AS space_name,
    s.type AS space_type,
    COALESCE(sm.relationship_tag, 'Personal'::text) AS relationship_tag
FROM public.calendar_events ce
LEFT JOIN public.space_members sm
    ON sm.space_id = ce.space_id AND sm.user_id = auth.uid()
LEFT JOIN public.spaces s ON s.id = ce.space_id;
