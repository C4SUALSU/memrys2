-- Memrys v3.0 Core Schema Migration
-- Project: geslobllyofmzxnyyeby
-- Date: 2026-06-20

-- ENUMS
CREATE TYPE public.relationship_label AS ENUM ('partner', 'family', 'friend', 'custom');
CREATE TYPE public.space_type AS ENUM ('direct_partner', 'group_chat', 'family_circle');
CREATE TYPE public.confirmation_status AS ENUM ('confirmed', 'pending', 'rejected');

-- TABLES
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text NOT NULL,
  avatar_url text,
  timezone text NOT NULL DEFAULT 'UTC',
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE public.spaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text,
  type public.space_type NOT NULL,
  created_by uuid NOT NULL REFERENCES public.profiles(id),
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.space_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id uuid NOT NULL REFERENCES public.spaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  joined_at timestamptz DEFAULT now(),
  UNIQUE(space_id, user_id)
);

CREATE TABLE public.chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id uuid NOT NULL REFERENCES public.spaces(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  message_text text NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.calendar_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id uuid REFERENCES public.spaces(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text DEFAULT '',
  start_time timestamptz NOT NULL,
  end_time timestamptz NOT NULL,
  is_all_day boolean DEFAULT false,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.calendar_event_attendees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.calendar_events(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status public.confirmation_status DEFAULT 'pending',
  updated_at timestamptz DEFAULT now(),
  UNIQUE(event_id, user_id)
);

CREATE TABLE public.user_model_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('openai', 'anthropic', 'google', 'openrouter')),
  model_id text NOT NULL,
  display_name text,
  vault_key_id uuid,
  is_default boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operation text NOT NULL,
  table_name text NOT NULL,
  record_id uuid,
  user_id uuid,
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz DEFAULT now()
);

-- INDEXES
CREATE INDEX idx_spaces_created_by ON public.spaces(created_by);
CREATE INDEX idx_space_members_space_id ON public.space_members(space_id);
CREATE INDEX idx_space_members_user_id ON public.space_members(user_id);
CREATE INDEX idx_chat_messages_space_id ON public.chat_messages(space_id);
CREATE INDEX idx_chat_messages_sender_id ON public.chat_messages(sender_id);
CREATE INDEX idx_chat_messages_created_at ON public.chat_messages(created_at);
CREATE INDEX idx_calendar_events_space_id ON public.calendar_events(space_id);
CREATE INDEX idx_calendar_events_created_by ON public.calendar_events(created_by);
CREATE INDEX idx_calendar_events_start_time ON public.calendar_events(start_time);
CREATE INDEX idx_calendar_event_attendees_event_id ON public.calendar_event_attendees(event_id);
CREATE INDEX idx_calendar_event_attendees_user_id ON public.calendar_event_attendees(user_id);
CREATE INDEX idx_user_model_configs_user_id ON public.user_model_configs(user_id);
CREATE INDEX idx_audit_log_user_id ON public.audit_log(user_id);
CREATE INDEX idx_audit_log_table_name ON public.audit_log(table_name);
CREATE INDEX idx_calendar_events_metadata ON public.calendar_events USING GIN (metadata);

-- FUNCTIONS & TRIGGERS
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.cleanup_attendees_on_leave()
RETURNS trigger AS $$
BEGIN
  DELETE FROM public.calendar_event_attendees
  WHERE user_id = OLD.user_id
    AND event_id IN (
      SELECT id FROM public.calendar_events WHERE space_id = OLD.space_id
    );
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

DROP TRIGGER IF EXISTS on_space_member_deleted ON public.space_members;
CREATE TRIGGER on_space_member_deleted
  AFTER DELETE ON public.space_members
  FOR EACH ROW EXECUTE FUNCTION public.cleanup_attendees_on_leave();

-- VAULT FUNCTIONS
CREATE OR REPLACE FUNCTION public.store_model_key(
  p_provider text,
  p_model_id text,
  p_display_name text,
  p_api_key text
)
RETURNS uuid AS $$
DECLARE
  v_vault_id uuid;
  v_config_id uuid;
BEGIN
  SELECT vault.create_secret(p_api_key, COALESCE(p_display_name, p_model_id) || ' API Key') INTO v_vault_id;
  INSERT INTO public.user_model_configs (user_id, provider, model_id, display_name, vault_key_id)
  VALUES (auth.uid(), p_provider, p_model_id, p_display_name, v_vault_id)
  RETURNING id INTO v_config_id;
  RETURN v_config_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

CREATE OR REPLACE FUNCTION public.get_decrypted_model_key(p_config_id uuid)
RETURNS text AS $$
DECLARE
  v_vault_id uuid;
  v_key text;
BEGIN
  SELECT vault_key_id INTO v_vault_id FROM public.user_model_configs WHERE id = p_config_id AND user_id = auth.uid();
  IF v_vault_id IS NULL THEN RAISE EXCEPTION 'Model config not found or access denied'; END IF;
  SELECT decrypted_secret INTO v_key FROM vault.decrypted_secrets WHERE id = v_vault_id;
  RETURN v_key;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

CREATE OR REPLACE FUNCTION public.delete_model_key(p_config_id uuid)
RETURNS void AS $$
DECLARE
  v_vault_id uuid;
BEGIN
  SELECT vault_key_id INTO v_vault_id FROM public.user_model_configs WHERE id = p_config_id AND user_id = auth.uid();
  IF v_vault_id IS NULL THEN RAISE EXCEPTION 'Model config not found or access denied'; END IF;
  DELETE FROM public.user_model_configs WHERE id = p_config_id;
  PERFORM vault.delete_secret(v_vault_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- AUDIT TRIGGERS
CREATE OR REPLACE FUNCTION public.audit_trigger_func()
RETURNS trigger AS $$
DECLARE
  v_user_id uuid;
BEGIN
  v_user_id := auth.uid();
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_log (operation, table_name, record_id, user_id, new_data) VALUES (TG_OP, TG_TABLE_NAME, NEW.id, v_user_id, to_jsonb(NEW));
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.audit_log (operation, table_name, record_id, user_id, old_data, new_data) VALUES (TG_OP, TG_TABLE_NAME, NEW.id, v_user_id, to_jsonb(OLD), to_jsonb(NEW));
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.audit_log (operation, table_name, record_id, user_id, old_data) VALUES (TG_OP, TG_TABLE_NAME, OLD.id, v_user_id, to_jsonb(OLD));
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

DROP TRIGGER IF EXISTS audit_calendar_events ON public.calendar_events;
CREATE TRIGGER audit_calendar_events AFTER INSERT OR UPDATE OR DELETE ON public.calendar_events FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();
DROP TRIGGER IF EXISTS audit_chat_messages ON public.chat_messages;
CREATE TRIGGER audit_chat_messages AFTER INSERT OR UPDATE OR DELETE ON public.chat_messages FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();
DROP TRIGGER IF EXISTS audit_space_members ON public.space_members;
CREATE TRIGGER audit_space_members AFTER INSERT OR UPDATE OR DELETE ON public.space_members FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();
DROP TRIGGER IF EXISTS audit_user_model_configs ON public.user_model_configs;
CREATE TRIGGER audit_user_model_configs AFTER INSERT OR UPDATE OR DELETE ON public.user_model_configs FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

-- RLS Helper: SECURITY DEFINER function breaks self-referencing RLS recursion
CREATE OR REPLACE FUNCTION public.is_space_member(check_space_id uuid, check_user_id uuid)
RETURNS boolean
SECURITY DEFINER SET search_path = ''
LANGUAGE sql STABLE
AS $$
  SELECT EXISTS(SELECT 1 FROM public.space_members WHERE space_id = check_space_id AND user_id = check_user_id);
$$;

-- RLS POLICIES
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own profile" ON public.profiles FOR SELECT USING (id = auth.uid());
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (id = auth.uid());

ALTER TABLE public.spaces ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members can read spaces" ON public.spaces FOR SELECT USING (is_space_member(id, auth.uid()) OR created_by = auth.uid());
CREATE POLICY "Auth users can create spaces" ON public.spaces FOR INSERT WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Creator can update spaces" ON public.spaces FOR UPDATE USING (created_by = auth.uid());

ALTER TABLE public.space_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members can see space members" ON public.space_members FOR SELECT USING (is_space_member(space_id, auth.uid()));
CREATE POLICY "Users can join spaces" ON public.space_members FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can leave spaces" ON public.space_members FOR DELETE USING (user_id = auth.uid());

ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members can read chat" ON public.chat_messages FOR SELECT USING (is_space_member(space_id, auth.uid()));
CREATE POLICY "Members can send messages" ON public.chat_messages FOR INSERT WITH CHECK (is_space_member(space_id, auth.uid()) AND sender_id = auth.uid());

ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Creator or member can read events" ON public.calendar_events FOR SELECT USING (created_by = auth.uid() OR (space_id IS NOT NULL AND is_space_member(space_id, auth.uid())));
CREATE POLICY "Auth users can create events" ON public.calendar_events FOR INSERT WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Creator can update events" ON public.calendar_events FOR UPDATE USING (created_by = auth.uid());
CREATE POLICY "Creator can delete events" ON public.calendar_events FOR DELETE USING (created_by = auth.uid());

ALTER TABLE public.calendar_event_attendees ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own attendee status" ON public.calendar_event_attendees FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can confirm own attendance" ON public.calendar_event_attendees FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own attendance" ON public.calendar_event_attendees FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Users can remove own attendance" ON public.calendar_event_attendees FOR DELETE USING (user_id = auth.uid());

ALTER TABLE public.user_model_configs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own model configs" ON public.user_model_configs FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can insert own model configs" ON public.user_model_configs FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own model configs" ON public.user_model_configs FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Users can delete own model configs" ON public.user_model_configs FOR DELETE USING (user_id = auth.uid());

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own audit entries" ON public.audit_log FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "System can insert audit entries" ON public.audit_log FOR INSERT WITH CHECK (true);
