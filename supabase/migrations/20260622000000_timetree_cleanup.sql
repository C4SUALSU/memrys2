-- Memrys v3.0 TimeTree Cleanup Migration
-- Date: 2026-06-22

-- 1. calendar_events.created_by FK → ON DELETE SET NULL
-- Detaches user ID from events without deleting them from shared space calendars
ALTER TABLE public.calendar_events DROP CONSTRAINT IF EXISTS calendar_events_created_by_fkey;
ALTER TABLE public.calendar_events ADD CONSTRAINT calendar_events_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- calendar_event_attendees.user_id and space_members.user_id already have ON DELETE CASCADE
-- No changes needed for those.

-- 2. Atomic "last man standing" account deletion function
CREATE OR REPLACE FUNCTION public.delete_own_account()
RETURNS boolean
SECURITY DEFINER SET search_path = ''
LANGUAGE plpgsql
AS $$
DECLARE
  v_user_id uuid;
  v_space_id uuid;
BEGIN
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Identify all spaces where the current user is a member
  FOR v_space_id IN
    SELECT sm.space_id
    FROM public.space_members sm
    WHERE sm.user_id = v_user_id
  LOOP
    -- If the user is the only member, delete the entire space (cascades to events, messages, etc.)
    IF (SELECT COUNT(*) FROM public.space_members WHERE space_id = v_space_id) = 1 THEN
      DELETE FROM public.spaces WHERE id = v_space_id;
    END IF;
  END LOOP;

  -- Nullify created_by on persistent spaces to avoid FK violation
  UPDATE public.spaces SET created_by = NULL WHERE created_by = v_user_id;

  -- Delete profile (cascades: space_members, event_attendees, chat_messages, friend_connections, model_configs)
  DELETE FROM public.profiles WHERE id = v_user_id;

  -- Delete the auth user record
  DELETE FROM auth.users WHERE id = v_user_id;

  RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_own_account() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_own_account() TO authenticated;
