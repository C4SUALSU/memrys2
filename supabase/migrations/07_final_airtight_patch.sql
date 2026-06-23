-- Memrys v3.2 Final Airtight RLS + Relationship Tag Alignment Patch
-- Date: 2026-06-24

-- ============================================================
-- 1. ABSOLUTE CHAT RLS — drop all legacy names, create v2
-- ============================================================
DROP POLICY IF EXISTS "Allow space members absolute chat access" ON public.chat_messages;
DROP POLICY IF EXISTS "Allow members to interact with space chat" ON public.chat_messages;
DROP POLICY IF EXISTS "Airtight space members chat access" ON public.chat_messages;

CREATE POLICY "Airtight space members chat access v2"
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
-- 2. ADD relationship_tag TO friend_connections
-- ============================================================
ALTER TABLE public.friend_connections
ADD COLUMN IF NOT EXISTS relationship_tag text DEFAULT 'Friend';

ALTER TABLE public.friend_connections
DROP CONSTRAINT IF EXISTS check_friend_relationship_tag;

ALTER TABLE public.friend_connections
ADD CONSTRAINT check_friend_relationship_tag
CHECK (relationship_tag IN ('Partner', 'Family', 'Friend', 'Work', 'Other'));

-- ============================================================
-- 3. REPLACE space_members UPDATE POLICY WITH FOR ALL
-- ============================================================
DROP POLICY IF EXISTS "Members can update tags" ON public.space_members;
DROP POLICY IF EXISTS "Allow users to update member tags" ON public.space_members;

CREATE POLICY "Allow users to update member tags"
ON public.space_members
FOR ALL
TO authenticated
USING (
  user_id = auth.uid()
  OR space_id IN (
    SELECT space_id FROM public.space_members WHERE user_id = auth.uid()
  )
)
WITH CHECK (
  user_id = auth.uid()
  OR space_id IN (
    SELECT space_id FROM public.space_members WHERE user_id = auth.uid()
  )
);
