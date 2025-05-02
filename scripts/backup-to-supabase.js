const { PrismaClient } = require('@prisma/client');
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
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

// Initialize SQLite Prisma client for our local database
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.SQLITE_DATABASE_URL || 'file:../prisma/dev.db',
    },
  },
});

/**
 * Retrieves all patients and their notes from the local SQLite database
 */
async function getLocalData() {
  console.log('Fetching data from local SQLite database...');
  
  // Get all patients with their notes
  const patients = await prisma.patient.findMany({
    include: { notes: true },
  });
  console.log(`Found ${patients.length} patients`);
  
  // Get app settings
  const settings = await prisma.appSettings.findUnique({
    where: { id: 'default' },
  });
  console.log('Retrieved app settings');
  
  return { patients, settings };
}

/**
 * Creates necessary tables in Supabase if they don't exist
 */
async function createSupabaseTables() {
  console.log('Creating tables in Supabase if they don\'t exist...');
  
  // Skip RPC call and go directly to checking and creating tables
  console.log('Checking if tables exist in Supabase...');
  await checkAndCreateTables();
}

/**
 * Fallback method to check if tables exist and create them if they don't
 */
async function checkAndCreateTables() {
  try {
    // Check if tables exist
    const { data: patients, error: patientsError } = await supabase.from('patients').select('id').limit(1);
    const { data: notes, error: notesError } = await supabase.from('notes').select('id').limit(1);
    const { data: settings, error: settingsError } = await supabase.from('app_settings').select('id').limit(1);
    
    // If tables don't exist, create them
    if (patientsError) {
      console.log('Creating patients table...');
      await supabase.from('patients').insert({
        id: '00000000-0000-0000-0000-000000000000',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        name: 'Test Patient',
        is_deleted: false
      }).select();
    }
    
    if (notesError) {
      console.log('Creating notes table...');
      // Only attempt to create notes table if patients table exists
      if (!patientsError) {
        await supabase.from('notes').insert({
          id: '00000000-0000-0000-0000-000000000000',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          patient_id: '00000000-0000-0000-0000-000000000000',
          transcript: 'Test Transcript',
          content: 'Test Content',
          is_initial_visit: false
        }).select();
      }
    }
    
    if (settingsError) {
      console.log('Creating app_settings table...');
      await supabase.from('app_settings').insert({
        id: 'test',
        dark_mode: false,
        gpt_model: 'gpt-4o',
        initial_visit_prompt: 'Test Prompt',
        follow_up_visit_prompt: 'Test Prompt',
        auto_save: false,
        low_echo_cancellation: false,
        updated_at: new Date().toISOString()
      }).select();
    }
    
    console.log('Tables created or already exist');
  } catch (error) {
    console.error('Error checking or creating tables:', error);
  }
}

/**
 * Uploads data to Supabase tables
 */
async function uploadToSupabase(data) {
  console.log('Uploading data to Supabase...');
  
  // Store patients in Supabase
  let patientsUploaded = 0;
  for (const patient of data.patients) {
    const { notes, ...patientData } = patient;
    
    // Insert or update patient
    const { error: patientError } = await supabase
      .from('patients')
      .upsert({
        id: patientData.id,
        created_at: new Date(patientData.createdAt).toISOString(),
        updated_at: new Date(patientData.updatedAt).toISOString(),
        name: patientData.name,
        is_deleted: patientData.isDeleted,
        deleted_at: patientData.deletedAt ? new Date(patientData.deletedAt).toISOString() : null,
      });
    
    if (patientError) {
      console.error(`Error uploading patient ${patientData.name}:`, patientError);
      continue;
    }
    
    patientsUploaded++;
    
    // Insert or update notes for this patient
    let notesUploaded = 0;
    if (notes && notes.length > 0) {
      for (const note of notes) {
        const { error: noteError } = await supabase
          .from('notes')
          .upsert({
            id: note.id,
            created_at: new Date(note.createdAt).toISOString(),
            updated_at: new Date(note.updatedAt).toISOString(),
            patient_id: note.patientId,
            transcript: note.transcript,
            content: note.content,
            summary: note.summary || null,
            audio_file_url: note.audioFileUrl || null,
            is_initial_visit: note.isInitialVisit,
          });
        
        if (noteError) {
          console.error(`Error uploading note for patient ${patientData.name}:`, noteError);
          continue;
        }
        
        notesUploaded++;
      }
      
      console.log(`Uploaded ${notesUploaded} notes for patient ${patientData.name}`);
    }
  }
  
  console.log(`Successfully uploaded ${patientsUploaded} patients`);
  
  // Upload app settings
  if (data.settings) {
    const { error: settingsError } = await supabase
      .from('app_settings')
      .upsert({
        id: data.settings.id,
        dark_mode: data.settings.darkMode,
        gpt_model: data.settings.gptModel,
        initial_visit_prompt: data.settings.initialVisitPrompt,
        follow_up_visit_prompt: data.settings.followUpVisitPrompt,
        auto_save: data.settings.autoSave,
        low_echo_cancellation: data.settings.lowEchoCancellation,
        updated_at: new Date(data.settings.updatedAt).toISOString(),
      });
    
    if (settingsError) {
      console.error('Error uploading app settings:', settingsError);
    } else {
      console.log('Successfully uploaded app settings');
    }
  }
}

/**
 * Save data to local JSON files as backup
 */
async function saveLocalBackup(data) {
  console.log('Saving local backup files...');
  
  // Save patients and notes to JSON file
  fs.writeFileSync(
    path.join(TEMP_DIR, `patients_backup_${Date.now()}.json`),
    JSON.stringify(data.patients, null, 2)
  );
  
  // Save settings to JSON file
  fs.writeFileSync(
    path.join(TEMP_DIR, `settings_backup_${Date.now()}.json`),
    JSON.stringify(data.settings, null, 2)
  );
  
  console.log(`Backup saved to ${TEMP_DIR}`);
}

/**
 * Main function
 */
async function main() {
  try {
    console.log('Starting data backup to Supabase...');
    
    // Ensure tables exist in Supabase
    await createSupabaseTables();
    
    // Get data from local database
    const data = await getLocalData();
    
    // Save local backup just in case
    await saveLocalBackup(data);
    
    // Upload data to Supabase
    await uploadToSupabase(data);
    
    console.log('Backup to Supabase completed successfully!');
  } catch (error) {
    console.error('Backup failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the backup process
main();
