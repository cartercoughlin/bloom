-- Add email_preferences table for managing user email notification settings
-- This allows users to opt-in/opt-out of daily budget digests

CREATE TABLE IF NOT EXISTS public.email_preferences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  daily_digest_enabled BOOLEAN DEFAULT false,
  digest_time TIME DEFAULT '08:00:00', -- Preferred time for digest (future use)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.email_preferences ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "email_preferences_select_own" ON public.email_preferences
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "email_preferences_insert_own" ON public.email_preferences
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "email_preferences_update_own" ON public.email_preferences
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "email_preferences_delete_own" ON public.email_preferences
  FOR DELETE USING (auth.uid() = user_id);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_email_preferences_user_id ON public.email_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_email_preferences_daily_digest ON public.email_preferences(daily_digest_enabled) WHERE daily_digest_enabled = true;

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_email_preferences_updated_at
  BEFORE UPDATE ON public.email_preferences
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Insert default preferences for existing users (opt-out by default)
INSERT INTO public.email_preferences (user_id, daily_digest_enabled)
SELECT id, false
FROM auth.users
WHERE id NOT IN (SELECT user_id FROM public.email_preferences)
ON CONFLICT (user_id) DO NOTHING;
