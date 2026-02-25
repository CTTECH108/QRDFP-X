
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Chat rooms table
CREATE TABLE public.rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Encrypted messages table
CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL,
  sender_name TEXT NOT NULL DEFAULT 'Anonymous',
  encrypted_payload TEXT NOT NULL,
  iv TEXT NOT NULL,
  entropy_source TEXT NOT NULL DEFAULT 'software',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Entropy log
CREATE TABLE public.entropy_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entropy_hex TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'hardware',
  used BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Encrypted file metadata
CREATE TABLE public.file_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID REFERENCES public.rooms(id) ON DELETE CASCADE,
  uploader_id UUID NOT NULL,
  uploader_name TEXT NOT NULL DEFAULT 'Anonymous',
  original_name TEXT NOT NULL,
  encrypted_path TEXT NOT NULL,
  iv TEXT NOT NULL,
  file_size BIGINT NOT NULL DEFAULT 0,
  entropy_source TEXT NOT NULL DEFAULT 'software',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- User profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS Policies
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entropy_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.file_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rooms_select" ON public.rooms FOR SELECT TO authenticated USING (true);
CREATE POLICY "rooms_insert" ON public.rooms FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);

CREATE POLICY "messages_select" ON public.messages FOR SELECT TO authenticated USING (true);
CREATE POLICY "messages_insert" ON public.messages FOR INSERT TO authenticated WITH CHECK (auth.uid() = sender_id);

CREATE POLICY "entropy_select" ON public.entropy_log FOR SELECT TO authenticated USING (true);

CREATE POLICY "files_select" ON public.file_transfers FOR SELECT TO authenticated USING (true);
CREATE POLICY "files_insert" ON public.file_transfers FOR INSERT TO authenticated WITH CHECK (auth.uid() = uploader_id);

CREATE POLICY "profiles_select" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.file_transfers;
ALTER PUBLICATION supabase_realtime ADD TABLE public.entropy_log;

-- Trigger for profile creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, username)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
