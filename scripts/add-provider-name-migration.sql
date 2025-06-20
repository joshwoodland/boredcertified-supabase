-- Migration script to add provider_name column to app_settings table
-- Run this after the main supabase-setup.sql script

-- Add provider_name column to app_settings table
ALTER TABLE public.app_settings 
ADD COLUMN IF NOT EXISTS provider_name TEXT NOT NULL DEFAULT 'Josh Woodland, APRN, PMHNP';

-- Add user_id and email columns if they don't exist (for user-specific settings)
ALTER TABLE public.app_settings 
ADD COLUMN IF NOT EXISTS user_id TEXT,
ADD COLUMN IF NOT EXISTS email TEXT;

-- Update existing default settings record to include provider name
UPDATE public.app_settings 
SET provider_name = 'Josh Woodland, APRN, PMHNP' 
WHERE id = 'default' AND (provider_name IS NULL OR provider_name = '');

-- Insert default settings record if it doesn't exist
INSERT INTO public.app_settings (
  id, 
  dark_mode, 
  gpt_model, 
  initial_visit_additional_preferences, 
  follow_up_visit_prompt, 
  auto_save, 
  low_echo_cancellation, 
  provider_name,
  updated_at
) VALUES (
  'default',
  true,
  'gpt-4o',
  '',
  'Focus on changes since the last visit. Highlight any medication adjustments with "CHANGED" label.',
  true,
  true,
  'Josh Woodland, APRN, PMHNP',
  now()
) ON CONFLICT (id) DO UPDATE SET
  provider_name = EXCLUDED.provider_name,
  updated_at = now();

-- Create index on user_id for better performance
CREATE INDEX IF NOT EXISTS idx_app_settings_user_id ON public.app_settings(user_id);

-- Note: This migration adds the provider_name field to support dynamic provider names in SOAP notes
-- Existing users will get the default provider name and can update it in their settings 