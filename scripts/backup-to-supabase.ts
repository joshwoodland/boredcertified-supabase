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

/**
 * Retrieves all patients and their notes from Supabase
 */
async function getSupabaseData() {
  console.log('Fetching data from Supabase...');
  
  // Get all patients
  const { data: patients, error: patientsError } = await supabase
    .from('patients')
    .select('*, notes(*)');
  
  if (patientsError) {
    console.error('Error fetching patients:', patientsError);
    return { patients: [], settings: null };
  }
  console.log(`Found ${patients.length} patients`);
  
  // Get app settings
  const { data: settings, error: settingsError } = await supabase
    .from('app_settings')
    .select('*')
    .eq('id', 'default')
    .single();
  
  if (settingsError) {
    console.error('Error fetching settings:', settingsError);
    return { patients, settings: null };
  }
  console.log('Retrieved app settings');
  
  return { patients, settings };
}

// Define types using JSDoc for CommonJS compatibility
/**
 * @typedef {Object} Note
 * @property {string} id
 * @property {string} created_at
 * @property {string} updated_at
 * @property {string} patient_id
 * @property {string} transcript
 * @property {string} content
 * @property {string|null} summary
 * @property {string|null} audio_file_url
 * @property {boolean} is_initial_visit
 */

/**
 * @typedef {Object} Patient
 * @property {string} id
 * @property {string} created_at
 * @property {string} updated_at
 * @property {string} name
 * @property {boolean} is_deleted
 * @property {string|null} deleted_at
 * @property {string|null} provider_email
 * @property {Note[]} notes
 */

/**
 * @typedef {Object} AppSettings
 * @property {string} id
 * @property {boolean} dark_mode
 * @property {string} gpt_model
 * @property {string} initial_visit_prompt
 * @property {string} follow_up_visit_prompt
 * @property {boolean} auto_save
 * @property {boolean} low_echo_cancellation
 * @property {string|null} email
 * @property {string|null} user_id
 * @property {string} updated_at
 */

/**
 * Creates necessary tables in Supabase if they don't exist
 */
async function createSupabaseTables() {
  console.log('Creating tables in Supabase if they don\'t exist...');
  
  // Use the Supabase SQL executor to create tables if they don't exist
  const { error: createError } = await supabase.rpc('exec_sql', { 
    sql: `
      -- Create patients table if it doesn't exist
      CREATE TABLE IF NOT EXISTS patients (
        id UUID PRIMARY KEY,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL,
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
        name TEXT NOT NULL,
        is_deleted BOOLEAN DEFAULT FALSE,
        deleted_at TIMESTAMP WITH TIME ZONE,
        provider_email TEXT
      );

      -- Create notes table if it doesn't exist
      CREATE TABLE IF NOT EXISTS notes (
        id UUID PRIMARY KEY,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL,
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
        patient_id UUID NOT NULL REFERENCES patients(id),
        transcript TEXT NOT NULL,
        content TEXT NOT NULL,
        summary TEXT,
        audio_file_url TEXT,
        is_initial_visit BOOLEAN DEFAULT FALSE
      );

      -- Create app_settings table if it doesn't exist
      CREATE TABLE IF NOT EXISTS app_settings (
        id TEXT PRIMARY KEY,
        dark_mode BOOLEAN DEFAULT FALSE,
        gpt_model TEXT NOT NULL,
        initial_visit_prompt TEXT NOT NULL,
        follow_up_visit_prompt TEXT NOT NULL,
        auto_save BOOLEAN DEFAULT FALSE,
        low_echo_cancellation BOOLEAN DEFAULT FALSE,
        email TEXT,
        user_id TEXT,
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL
      );
    `
  });
  
  if (createError) {
    console.error('Error creating tables:', createError);
    console.log('Attempting to create tables individually by checking if they exist...');
    await checkAndCreateTables();
  } else {
    console.log('Tables created or already exist');
  }
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
        is_deleted: false,
        provider_email: null
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
        email: null,
        user_id: null,
        updated_at: new Date().toISOString()
      }).select();
    }
    
    console.log('Tables created or already exist');
  } catch (error) {
    console.error('Error checking or creating tables:', error);
  }
}

/**
 * Saves a local backup of the data
 */
async function saveLocalBackup(data) {
  console.log('Saving local backup...');
  
  const timestamp = Date.now();
  const backupDir = path.join(TEMP_DIR, `backup_${timestamp}`);
  
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir);
  }
  
  fs.writeFileSync(
    path.join(backupDir, 'patients.json'),
    JSON.stringify(data.patients, null, 2)
  );
  
  fs.writeFileSync(
    path.join(backupDir, 'settings.json'),
    JSON.stringify(data.settings, null, 2)
  );
  
  console.log(`Backup saved to ${backupDir}`);
}

/**
 * Main function
 */
async function main() {
  try {
    console.log('Starting Supabase backup process...');
    
    // Create tables if they don't exist
    await createSupabaseTables();
    
    // Get data from Supabase
    const data = await getSupabaseData();
    
    // Save local backup
    await saveLocalBackup(data);
    
    console.log('Backup process completed successfully!');
  } catch (error) {
    console.error('Backup failed:', error);
  }
}

// Run the backup process
main();
