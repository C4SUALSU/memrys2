-- Memrys v3.0 - Fix delete_own_account RPC schema cache resolution
-- Drops mismatched signatures and rebuilds with proper search_path visibility

-- 1. Wipe all prior function signatures to clear schema cache ambiguity
DROP FUNCTION IF EXISTS public.delete_own_account();
DROP FUNCTION IF EXISTS public.delete_own_account(uuid);

-- 2. Rebuild with correct search_path so Supabase schema cache resolves properly
CREATE OR REPLACE FUNCTION public.delete_own_account()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    current_user_id uuid;
    space_record record;
BEGIN
    current_user_id := auth.uid();

    IF current_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    FOR space_record IN
        SELECT space_id
        FROM public.space_members
        WHERE user_id = current_user_id
    LOOP
        IF (SELECT count(*) FROM public.space_members WHERE space_id = space_record.space_id) = 1 THEN
            DELETE FROM public.spaces WHERE id = space_record.space_id;
        END IF;
    END LOOP;

    DELETE FROM public.profiles WHERE id = current_user_id;
    DELETE FROM auth.users WHERE id = current_user_id;

    RETURN true;
END;
$$;

-- 3. Restrict execution to authenticated users only
REVOKE EXECUTE ON FUNCTION public.delete_own_account() FROM public;
GRANT EXECUTE ON FUNCTION public.delete_own_account() TO authenticated;
