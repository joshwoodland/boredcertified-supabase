-- First, enable RLS on the notes table
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;

-- Create policy for selecting notes
-- Users can select any notes associated with existing patients
CREATE POLICY "Users can view all notes" ON notes
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM patients
    WHERE patients.id = notes.patient_id
  )
);

-- Create policy for inserting notes
-- Users can insert notes for any existing patient
CREATE POLICY "Users can create notes" ON notes
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM patients
    WHERE patients.id = patient_id
  )
);

-- Create policy for updating notes
-- Users can update any notes associated with existing patients
CREATE POLICY "Users can update notes" ON notes
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM patients
    WHERE patients.id = notes.patient_id
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM patients
    WHERE patients.id = patient_id
  )
);

-- Create policy for deleting notes
-- Users can delete any notes associated with existing patients
CREATE POLICY "Users can delete notes" ON notes
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM patients
    WHERE patients.id = notes.patient_id
  )
);

-- Also enable RLS on patients table for consistency
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;

-- Create policy for patients table - allow all authenticated users to access all patients
CREATE POLICY "Users can access all patients" ON patients
FOR ALL
USING (auth.role() = 'authenticated');

-- Enable RLS on app_settings table
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

-- Create policy for app_settings table - allow all authenticated users to access settings
CREATE POLICY "Users can access app settings" ON app_settings
FOR ALL
USING (auth.role() = 'authenticated'); 