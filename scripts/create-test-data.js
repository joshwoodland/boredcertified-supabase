const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const { v4: uuidv4 } = require('uuid');
const fs = require('node:fs');
const path = require('node:path');

// Load environment variables
dotenv.config({ path: '.env.local' });

// Create temp directory if it doesn't exist
const TEMP_DIR = path.join(process.cwd(), 'temp');
if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR);
}

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

// Sample data
const samplePatients = [
  {
    id: uuidv4(),
    name: 'John Doe',
    isDeleted: false
  },
  {
    id: uuidv4(),
    name: 'Jane Smith',
    isDeleted: false
  },
  {
    id: uuidv4(),
    name: 'Bob Johnson',
    isDeleted: false
  }
];

const sampleSettings = {
  id: 'default',
  darkMode: false,
  gptModel: 'gpt-4o',
  initialVisitPrompt: 'You are a medical scribe assistant. Your task is to generate a note for an INITIAL VISIT based on the provided medical visit transcript.',
  followUpVisitPrompt: 'You are a medical scribe assistant. Your task is to generate a note for a FOLLOW-UP VISIT based on the provided medical visit transcript.',
  autoSave: false,
  lowEchoCancellation: false
};

/**
 * Creates sample notes for a patient
 */
function createPatientNotes(patientId) {
  return [
    {
      id: uuidv4(),
      patientId: patientId,
      transcript: 'Sample initial visit transcript for discussion with the patient.',
      content: 'Patient reports symptoms of anxiety and stress. Discussion of treatment options including CBT.',
      summary: 'Initial visit for anxiety and stress.',
      isInitialVisit: true,
      audioFileUrl: null
    },
    {
      id: uuidv4(),
      patientId: patientId,
      transcript: 'Follow up visit to discuss progress with medication and therapy.',
      content: 'Patient reports improvement in symptoms. Continuing current treatment plan.',
      summary: 'Follow-up visit showing improvement.',
      isInitialVisit: false,
      audioFileUrl: null
    }
  ];
}

/**
 * Uploads data to Supabase tables
 */
async function uploadToSupabase() {
  console.log('Uploading test data to Supabase...');
  
  // Upload app settings
  console.log('Uploading app settings...');
  const { error: settingsError } = await supabase
    .from('app_settings')
    .upsert({
      id: sampleSettings.id,
      dark_mode: sampleSettings.darkMode,
      gpt_model: sampleSettings.gptModel,
      initial_visit_prompt: sampleSettings.initialVisitPrompt,
      follow_up_visit_prompt: sampleSettings.followUpVisitPrompt,
      auto_save: sampleSettings.autoSave,
      low_echo_cancellation: sampleSettings.lowEchoCancellation,
      updated_at: new Date().toISOString(),
    });
  
  if (settingsError) {
    console.error('Error uploading app settings:', settingsError);
  } else {
    console.log('Successfully uploaded app settings');
  }
  
  // Store patients in Supabase
  let patientsUploaded = 0;
  
  for (const patient of samplePatients) {
    // Insert patient
    const { error: patientError } = await supabase
      .from('patients')
      .upsert({
        id: patient.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        name: patient.name,
        is_deleted: patient.isDeleted,
        deleted_at: null,
      });
    
    if (patientError) {
      console.error(`Error uploading patient ${patient.name}:`, patientError);
      continue;
    }
    
    patientsUploaded++;
    
    // Generate and insert notes for this patient
    const notes = createPatientNotes(patient.id);
    let notesUploaded = 0;
    
    for (const note of notes) {
      const { error: noteError } = await supabase
        .from('notes')
        .upsert({
          id: note.id,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          patient_id: note.patientId,
          transcript: note.transcript,
          content: note.content,
          summary: note.summary,
          audio_file_url: note.audioFileUrl,
          is_initial_visit: note.isInitialVisit,
        });
      
      if (noteError) {
        console.error(`Error uploading note for patient ${patient.name}:`, noteError);
        continue;
      }
      
      notesUploaded++;
    }
    
    console.log(`Uploaded ${notesUploaded} notes for patient ${patient.name}`);
  }
  
  console.log(`Successfully uploaded ${patientsUploaded} patients`);
  
  // Save sample data to JSON files for reference
  fs.writeFileSync(
    path.join(TEMP_DIR, `sample_patients_${Date.now()}.json`),
    JSON.stringify(samplePatients, null, 2)
  );
  
  fs.writeFileSync(
    path.join(TEMP_DIR, `sample_settings_${Date.now()}.json`),
    JSON.stringify(sampleSettings, null, 2)
  );
  
  console.log(`Backup of sample data saved to ${TEMP_DIR}`);
}

/**
 * Main function
 */
async function main() {
  try {
    console.log('Starting test data upload to Supabase...');
    
    // Upload sample data to Supabase
    await uploadToSupabase();
    
    console.log('Sample data upload completed successfully!');
    console.log('Your Supabase database now contains test patients, notes, and app settings.');
  } catch (error) {
    console.error('Upload failed:', error);
  }
}

// Run the upload process
main();
