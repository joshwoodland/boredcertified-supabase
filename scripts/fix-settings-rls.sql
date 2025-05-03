-- SQL script to fix Row Level Security policies for app_settings table
-- Run this script in the Supabase SQL Editor

-- Enable Row Level Security
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Drop any existing policies
DROP POLICY IF EXISTS "Select own settings" ON public.app_settings;
DROP POLICY IF EXISTS "Insert own settings" ON public.app_settings;
DROP POLICY IF EXISTS "Update own settings" ON public.app_settings;
DROP POLICY IF EXISTS "Select public settings" ON public.app_settings;

-- Create policies
-- Policy 1: Allow users to select their own settings
CREATE POLICY "Select own settings" 
ON public.app_settings
FOR SELECT
USING (auth.uid() = user_id);

-- Policy 2: Allow users to select public settings (no user_id)
CREATE POLICY "Select public settings" 
ON public.app_settings
FOR SELECT
USING (user_id IS NULL);

-- Policy 3: Allow users to insert their own settings
CREATE POLICY "Insert own settings" 
ON public.app_settings
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Policy 4: Allow users to update their own settings
CREATE POLICY "Update own settings" 
ON public.app_settings
FOR UPDATE
USING (auth.uid() = user_id);

-- Create default settings if they don't exist
INSERT INTO public.app_settings (id, user_id, dark_mode, gpt_model, initial_visit_prompt, follow_up_visit_prompt, auto_save, low_echo_cancellation, updated_at)
VALUES ('default', NULL, true, 'gpt-4o', '', '', false, false, now())
ON CONFLICT (id) DO NOTHING;

-- Grant permissions for service role
GRANT ALL PRIVILEGES ON public.app_settings TO service_role;
GRANT ALL PRIVILEGES ON public.app_settings TO authenticated;
GRANT SELECT ON public.app_settings TO anon;
