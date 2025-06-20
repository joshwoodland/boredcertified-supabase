-- Migration script to add supervisor column to app_settings table
-- Run this after the main supabase-setup.sql script

-- Add supervisor column to app_settings table
ALTER TABLE public.app_settings 
ADD COLUMN IF NOT EXISTS supervisor TEXT;

-- Update existing records to have NULL supervisor by default (no supervisor)
UPDATE public.app_settings 
SET supervisor = NULL 
WHERE supervisor IS NULL;

-- Note: supervisor is intentionally nullable - when NULL, use standard note ending
-- When supervisor has a value, use supervision-based note ending

-- Create index on supervisor for better performance (optional)
CREATE INDEX IF NOT EXISTS idx_app_settings_supervisor ON public.app_settings(supervisor);

-- Note: This migration adds the supervisor field to support supervision-based note endings
-- When supervisor is NULL or empty, use standard note endings
-- When supervisor has a name, use supervision-based note endings as specified 