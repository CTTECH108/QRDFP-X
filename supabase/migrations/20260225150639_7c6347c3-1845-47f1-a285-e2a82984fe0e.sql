-- Create profiles table
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  username TEXT NOT NULL,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Profiles are viewable by authenticated users" ON public.profiles
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can insert their own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = user_id);

-- Create function to handle new user profile creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, username)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'username', 'Agent_' || LEFT(NEW.id::text, 8)));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create messages table for encrypted messages
CREATE TABLE public.messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sender_id UUID NOT NULL,
  encrypted_content TEXT NOT NULL,
  iv TEXT NOT NULL,
  entropy_source TEXT NOT NULL DEFAULT 'software',
  message_type TEXT NOT NULL DEFAULT 'text',
  file_name TEXT,
  file_size BIGINT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view messages" ON public.messages
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can send messages" ON public.messages
  FOR INSERT WITH CHECK (auth.uid() = sender_id);

-- Enable realtime for messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;

-- Create entropy_log table to track QRNG status
CREATE TABLE public.entropy_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  entropy_hash TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'hardware',
  is_valid BOOLEAN NOT NULL DEFAULT true,
  received_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.entropy_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read entropy log" ON public.entropy_log
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Service role can insert entropy" ON public.entropy_log
  FOR INSERT WITH CHECK (true);

-- Storage bucket for encrypted files
INSERT INTO storage.buckets (id, name, public) VALUES ('encrypted-files', 'encrypted-files', false);

CREATE POLICY "Authenticated users can upload encrypted files" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'encrypted-files' AND auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can download encrypted files" ON storage.objects
  FOR SELECT USING (bucket_id = 'encrypted-files' AND auth.uid() IS NOT NULL);