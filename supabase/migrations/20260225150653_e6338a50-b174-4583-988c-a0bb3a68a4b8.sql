-- Drop the overly permissive policy and replace with a more restrictive one
DROP POLICY "Service role can insert entropy" ON public.entropy_log;

-- Only allow insert if user is authenticated (edge function will use service role anyway)
CREATE POLICY "No direct insert on entropy_log" ON public.entropy_log
  FOR INSERT WITH CHECK (false);