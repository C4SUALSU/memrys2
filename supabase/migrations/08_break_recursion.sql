-- Memrys v3.2 Break RLS Recursion + Restore View + Group Chat Access
-- Date: 2026-06-24

-- ============================================================
-- 1. BREAK RECURSION ON space_members
-- ============================================================

-- Drop the recursive FOR ALL policy (self-referencing subquery)
DROP POLICY IF EXISTS "Allow users to update member tags" ON public.space_members;

-- Drop the INSERT policy (also self-referencing via EXISTS on same table)
DROP POLICY IF EXISTS "Members can invite users" ON public.space_members;

-- Self-only write: INSERT own membership, UPDATE own tag, DELETE self
CREATE POLICY "Manage own membership"
ON public.space_members
FOR ALL
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Open read: any authenticated user can see all memberships
-- (profiles are already public via "Users can read any profile" on public.profiles)
CREATE POLICY "View space memberships"
ON public.space_members
FOR SELECT
TO authenticated
USING (true);

-- ============================================================
-- 2. CREATE INVITE RPC (bypasses RLS for member invitations)
-- ============================================================
CREATE OR REPLACE FUNCTION public.invite_user_to_space(
  p_space_id uuid,
  p_target_user_id uuid
)
RETURNS void
SECURITY DEFINER
SET search_path = public, auth
LANGUAGE plpgsql
AS $$
BEGIN
  -- Verify caller is a member of this space
  IF NOT public.is_space_member(p_space_id, auth.uid()) THEN
    RAISE EXCEPTION 'You are not a member of this space';
  END IF;

  -- Verify target user exists
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_target_user_id) THEN
    RAISE EXCEPTION 'Target user does not exist';
  END IF;

  INSERT INTO public.space_members (space_id, user_id, relationship_tag)
  VALUES (p_space_id, p_target_user_id, 'Friend')
  ON CONFLICT (space_id, user_id) DO NOTHING;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.invite_user_to_space(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.invite_user_to_space(uuid, uuid) TO authenticated;

-- ============================================================
-- 3. FIX CHAT RLS — group chat pattern via spaces table
-- ============================================================
DROP POLICY IF EXISTS "Airtight space members chat access v2" ON public.chat_messages;

CREATE POLICY "Group chat access"
ON public.chat_messages
FOR ALL
TO authenticated
USING (
  -- Read gate: space must exist AND caller must be a member
  -- (spaces RLS uses is_space_member() SECURITY DEFINER — zero recursion)
  EXISTS (
    SELECT 1 FROM public.spaces WHERE id = chat_messages.space_id
  )
)
WITH CHECK (
  -- Write gate: must be yourself AND member of the target space
  sender_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.spaces WHERE id = chat_messages.space_id
  )
);
