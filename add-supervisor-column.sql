-- Add supervisor column to app_settings table
ALTER TABLE public.app_settings 
ADD COLUMN IF NOT EXISTS supervisor TEXT; 