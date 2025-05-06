import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  try {
    // Find Will's patient record
    const { data: patient, error: patientError } = await supabase
      .from('patients')
      .select('*')
      .eq('name', 'Will')
      .single();

    if (patientError) {
      console.error('Error finding patient:', patientError);
      return;
    }

    if (!patient) {
      console.log('No patient named Will found');
      return;
    }

    console.log('Found patient:', patient);

    // Get all notes for Will
    const { data: notes, error: notesError } = await supabase
      .from('notes')
      .select('*')
      .eq('patient_id', patient.id)
      .order('created_at', { ascending: false });

    if (notesError) {
      console.error('Error finding notes:', notesError);
      return;
    }

    console.log('\nNotes:');
    notes.forEach((note, index) => {
      console.log(`\nNote ${index + 1}:`);
      console.log('Created:', new Date(note.created_at).toLocaleString());
      console.log('Initial Visit:', note.is_initial_visit);
      console.log('Content:', note.content);
      console.log('Summary:', note.summary);
    });
  } catch (error) {
    console.error('Error:', error);
  }
}

main();
