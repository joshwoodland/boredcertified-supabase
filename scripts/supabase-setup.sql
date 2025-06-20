-- SQL script to set up tables in Supabase matching SQLite schema

-- Create patients table
CREATE TABLE IF NOT EXISTS public.patients (
  id UUID PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  name TEXT NOT NULL,
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  deleted_at TIMESTAMP WITH TIME ZONE,
  provider_email TEXT
);

-- Create notes table with relation to patients
CREATE TABLE IF NOT EXISTS public.notes (
  id UUID PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  patient_id UUID NOT NULL REFERENCES public.patients(id),
  transcript TEXT NOT NULL,
  content TEXT NOT NULL,
  summary TEXT,
  audio_file_url TEXT,
  is_initial_visit BOOLEAN NOT NULL DEFAULT false,
  checklist_content JSONB, -- Stores follow-up checklist items when this note is used as source
  source_note_id UUID -- References the note this checklist was generated from (if this is a follow-up visit)
);

-- Add foreign key constraint for source_note_id
ALTER TABLE public.notes ADD CONSTRAINT fk_source_note_id 
  FOREIGN KEY (source_note_id) REFERENCES public.notes(id) ON DELETE SET NULL;

-- Create app_settings table
CREATE TABLE IF NOT EXISTS public.app_settings (
  id TEXT PRIMARY KEY,
  dark_mode BOOLEAN NOT NULL DEFAULT false,
  gpt_model TEXT NOT NULL DEFAULT 'gpt-4o',
  initial_visit_additional_preferences TEXT NOT NULL DEFAULT '',
  follow_up_visit_prompt TEXT NOT NULL DEFAULT 'You are a medical scribe assistant. Your task is to generate a note for a FOLLOW-UP VISIT based on the provided medical visit transcript.',
  auto_save BOOLEAN NOT NULL DEFAULT false,
  low_echo_cancellation BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_patients_name ON public.patients(name);
CREATE INDEX IF NOT EXISTS idx_notes_patient_id ON public.notes(patient_id);
CREATE INDEX IF NOT EXISTS idx_notes_is_initial_visit ON public.notes(is_initial_visit);
CREATE INDEX IF NOT EXISTS idx_notes_source_note_id ON public.notes(source_note_id);
CREATE INDEX IF NOT EXISTS idx_notes_checklist_content ON public.notes USING GIN (checklist_content);

-- Enable Row Level Security
ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Create patient access policy based on provider email
CREATE POLICY "Providers can only access their own patients" ON public.patients 
  FOR ALL TO authenticated 
  USING (auth.jwt() ->> 'email' = provider_email OR provider_email IS NULL);

-- Create policy for notes: only accessible if the patient is accessible
CREATE POLICY "Providers can only access notes for their own patients" ON public.notes 
  FOR ALL TO authenticated 
  USING (
    EXISTS (
      SELECT 1 FROM public.patients 
      WHERE patients.id = notes.patient_id 
      AND (patients.provider_email = auth.jwt() ->> 'email' OR patients.provider_email IS NULL)
    )
  );
  
-- Settings are accessible to all authenticated users
CREATE POLICY "Allow full access to authenticated users" ON public.app_settings 
  FOR ALL TO authenticated USING (true);

-- Create an index on provider_email for better performance
CREATE INDEX IF NOT EXISTS idx_patients_provider_email ON public.patients(provider_email);

-- Note: After running this script, run the backup-to-supabase.js script to migrate your data
-- Command: node scripts/backup-to-supabase.js
