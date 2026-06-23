-- Memrys v3.2 Friend Tag RLS Policy Migration
-- Grants UPDATE permission for relationship_tag on friend_connections
-- Date: 2026-06-24

-- ============================================================
-- DROP existing policy (safe if doesn't exist)
-- CREATE new policy with explicit USING + WITH CHECK
-- Note: friend_connections has requester_id/recipient_id, NOT user_id
-- ============================================================
DROP POLICY IF EXISTS "Allow users to update friend tags" ON public.friend_connections;

CREATE POLICY "Allow users to update friend tags"
ON public.friend_connections
FOR UPDATE
TO authenticated
USING (requester_id = auth.uid() OR recipient_id = auth.uid())
WITH CHECK (requester_id = auth.uid() OR recipient_id = auth.uid());
