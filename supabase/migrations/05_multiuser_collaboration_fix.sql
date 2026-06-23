-- Memrys v3.2 Multi-User Collaboration Fix Migration
-- Rewrites RLS policies, adds member tags, creates cross-calendar view
-- Date: 2026-06-24

-- ============================================================
-- 1. FIX CHAT MESSAGES RLS
-- ============================================================
DROP POLICY IF EXISTS "Members can read chat" ON public.chat_messages;
DROP POLICY IF EXISTS "Members can send messages" ON public.chat_messages;

CREATE POLICY "Allow members to interact with space chat" ON public.chat_messages
FOR ALL TO authenticated
USING (EXISTS (
    SELECT 1 FROM public.space_members
    WHERE space_members.space_id = chat_messages.space_id
    AND space_members.user_id = auth.uid()
));

-- ============================================================
-- 2. FIX CALENDAR EVENTS RLS — space members can full CRUD
-- ============================================================
DROP POLICY IF EXISTS "Creator or member can read events" ON public.calendar_events;
DROP POLICY IF EXISTS "Auth users can create events" ON public.calendar_events;
DROP POLICY IF EXISTS "Creator can update events" ON public.calendar_events;
DROP POLICY IF EXISTS "Creator can delete events" ON public.calendar_events;

CREATE POLICY "Members can read events" ON public.calendar_events
FOR SELECT TO authenticated
USING (
    created_by = auth.uid()
    OR (
        space_id IS NOT NULL
        AND EXISTS (
            SELECT 1 FROM public.space_members
            WHERE space_members.space_id = calendar_events.space_id
            AND space_members.user_id = auth.uid()
        )
    )
);

CREATE POLICY "Auth users can create events" ON public.calendar_events
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Members can update events" ON public.calendar_events
FOR UPDATE TO authenticated
USING (
    created_by = auth.uid()
    OR (
        space_id IS NOT NULL
        AND EXISTS (
            SELECT 1 FROM public.space_members
            WHERE space_members.space_id = calendar_events.space_id
            AND space_members.user_id = auth.uid()
        )
    )
);

CREATE POLICY "Members can delete events" ON public.calendar_events
FOR DELETE TO authenticated
USING (
    created_by = auth.uid()
    OR (
        space_id IS NOT NULL
        AND EXISTS (
            SELECT 1 FROM public.space_members
            WHERE space_members.space_id = calendar_events.space_id
            AND space_members.user_id = auth.uid()
        )
    )
);

-- ============================================================
-- 3. FIX SPACES RLS — owner-only delete, members can update
-- ============================================================
DROP POLICY IF EXISTS "Members can read spaces" ON public.spaces;
DROP POLICY IF EXISTS "Auth users can create spaces" ON public.spaces;
DROP POLICY IF EXISTS "Creator can update spaces" ON public.spaces;

CREATE POLICY "Members can read spaces" ON public.spaces
FOR SELECT TO authenticated
USING (is_space_member(id, auth.uid()) OR created_by = auth.uid());

CREATE POLICY "Auth users can create spaces" ON public.spaces
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Members can update spaces" ON public.spaces
FOR UPDATE TO authenticated
USING (is_space_member(id, auth.uid()) OR created_by = auth.uid());

CREATE POLICY "Owner can delete spaces" ON public.spaces
FOR DELETE TO authenticated
USING (created_by = auth.uid());

-- ============================================================
-- 4. FIX SPACE MEMBERS RLS — invite and kick
-- ============================================================
DROP POLICY IF EXISTS "Members can see space members" ON public.space_members;
DROP POLICY IF EXISTS "Users can join spaces" ON public.space_members;
DROP POLICY IF EXISTS "Users can leave spaces" ON public.space_members;

CREATE POLICY "Members can see space members" ON public.space_members
FOR SELECT TO authenticated
USING (is_space_member(space_id, auth.uid()));

CREATE POLICY "Members can invite users" ON public.space_members
FOR INSERT TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.space_members AS sm
        WHERE sm.space_id = space_members.space_id
        AND sm.user_id = auth.uid()
    )
);

CREATE POLICY "Users can leave, owner can kick" ON public.space_members
FOR DELETE TO authenticated
USING (
    user_id = auth.uid()
    OR space_id IN (
        SELECT id FROM public.spaces WHERE created_by = auth.uid()
    )
);

CREATE POLICY "Members can update tags" ON public.space_members
FOR UPDATE TO authenticated
USING (is_space_member(space_id, auth.uid()))
WITH CHECK (is_space_member(space_id, auth.uid()));

-- ============================================================
-- 5. FIX PROFILES RLS — allow cross-user name resolution
-- ============================================================
DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;

CREATE POLICY "Users can read any profile" ON public.profiles
FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Users can update own profile" ON public.profiles
FOR UPDATE TO authenticated
USING (id = auth.uid());

-- ============================================================
-- 6. ADD MEMBER TAGS TO SPACE_MEMBERS
-- ============================================================
ALTER TABLE public.space_members
ADD COLUMN IF NOT EXISTS tag text NOT NULL DEFAULT 'friend';

DROP CONSTRAINT IF EXISTS space_members_tag_check ON public.space_members;
ALTER TABLE public.space_members
ADD CONSTRAINT space_members_tag_check CHECK (tag IN ('family', 'partner', 'work', 'friend', 'custom'));

-- ============================================================
-- 7. CREATE CROSS-CALENDAR INCLUSION VIEW
-- ============================================================

-- DROP VIEW first to recreate cleanly (security_invoker change)
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
    COALESCE(sm.tag, 'personal'::text) AS member_tag
FROM public.calendar_events ce
LEFT JOIN public.space_members sm
    ON sm.space_id = ce.space_id AND sm.user_id = auth.uid()
LEFT JOIN public.spaces s ON s.id = ce.space_id;
