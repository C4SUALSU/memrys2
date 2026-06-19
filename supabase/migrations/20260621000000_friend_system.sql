-- Memrys v3.0 Friend System Migration
-- Date: 2026-06-21

CREATE TYPE public.friend_status AS ENUM ('pending', 'accepted', 'rejected', 'blocked');

CREATE TABLE public.friend_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  recipient_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status public.friend_status DEFAULT 'pending',
  relationship public.relationship_label DEFAULT 'friend',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(requester_id, recipient_id),
  CHECK(requester_id <> recipient_id)
);

CREATE INDEX idx_friend_connections_requester ON public.friend_connections(requester_id);
CREATE INDEX idx_friend_connections_recipient ON public.friend_connections(recipient_id);
CREATE INDEX idx_friend_connections_status ON public.friend_connections(status);

-- Search users function
CREATE OR REPLACE FUNCTION public.search_users(search_query text)
RETURNS TABLE(id uuid, display_name text, avatar_url text)
SECURITY DEFINER SET search_path = ''
LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT p.id, p.display_name, p.avatar_url
  FROM public.profiles p
  WHERE p.display_name ILIKE '%' || search_query || '%'
     OR p.id IN (
       SELECT u.id FROM auth.users u WHERE u.email ILIKE '%' || search_query || '%'
     )
  ORDER BY
    CASE WHEN p.display_name ILIKE search_query || '%' THEN 0 ELSE 1 END,
    p.display_name
  LIMIT 20;
END;
$$;

-- RLS
ALTER TABLE public.friend_connections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own connections" ON public.friend_connections FOR SELECT
  USING (requester_id = auth.uid() OR recipient_id = auth.uid());
CREATE POLICY "Users can send requests" ON public.friend_connections FOR INSERT
  WITH CHECK (requester_id = auth.uid() AND requester_id <> recipient_id);
CREATE POLICY "Recipient can update status" ON public.friend_connections FOR UPDATE
  USING (recipient_id = auth.uid() OR requester_id = auth.uid());
CREATE POLICY "Users can delete own connections" ON public.friend_connections FOR DELETE
  USING (requester_id = auth.uid() OR recipient_id = auth.uid());

-- Audit trigger
DROP TRIGGER IF EXISTS audit_friend_connections ON public.friend_connections;
CREATE TRIGGER audit_friend_connections AFTER INSERT OR UPDATE OR DELETE ON public.friend_connections FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();
