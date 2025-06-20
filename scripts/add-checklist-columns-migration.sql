-- Migration script to add checklist support to existing notes table
-- Run this script if you already have a notes table without checklist columns

-- Add checklist_content column to store follow-up checklist items as JSON
ALTER TABLE public.notes ADD COLUMN IF NOT EXISTS checklist_content JSONB;

-- Add source_note_id column to reference the note this checklist was generated from
ALTER TABLE public.notes ADD COLUMN IF NOT EXISTS source_note_id UUID;

-- Add foreign key constraint for source_note_id (if not already exists)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'fk_source_note_id' 
        AND table_name = 'notes'
    ) THEN
        ALTER TABLE public.notes ADD CONSTRAINT fk_source_note_id 
            FOREIGN KEY (source_note_id) REFERENCES public.notes(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Create indexes for better performance (if not already exists)
CREATE INDEX IF NOT EXISTS idx_notes_source_note_id ON public.notes(source_note_id);
CREATE INDEX IF NOT EXISTS idx_notes_checklist_content ON public.notes USING GIN (checklist_content);

-- Update any existing notes to have null values for new columns (they should be null by default anyway)
UPDATE public.notes SET 
    checklist_content = NULL,
    source_note_id = NULL
WHERE checklist_content IS NOT NULL OR source_note_id IS NOT NULL;

COMMIT; 