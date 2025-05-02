// Simple script to test Supabase connection and utility functions
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';

// Load environment variables from .env.local
dotenv.config({ path: '.env.local' });

// Check if environment variables are loaded correctly
console.log('Environment variables:');
console.log('SUPABASE_URL:', process.env.SUPABASE_URL);
console.log('SUPABASE_SERVICE_ROLE_KEY:', process.env.SUPABASE_SERVICE_ROLE_KEY ? '[Set]' : '[Not Set]');

// Create Supabase client directly in the test script
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Error: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables are not set.');
  console.error('Please check your .env.local file.');
  
  // Print the content of .env.local file (without sensitive values)
  try {
    const envPath = path.resolve('.env.local');
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, 'utf8');
      const sanitizedContent = envContent
        .split('\n')
        .map(line => {
          if (line.includes('KEY=') || line.includes('SECRET=')) {
            const parts = line.split('=');
            return parts[0] + '=[REDACTED]';
          }
          return line;
        })
        .join('\n');
      
      console.log('\nContent of .env.local (sensitive values redacted):');
      console.log(sanitizedContent);
    } else {
      console.error('.env.local file not found');
    }
  } catch (err) {
    console.error('Error reading .env.local file:', err);
  }
  
  process.exit(1);
}

// Create Supabase client
const supabase = createClient(supabaseUrl, supabaseKey);

async function testSupabaseConnection() {
  try {
    console.log('Testing Supabase connection...');
    
    // Test connection by querying the patients table
    const { data, error } = await supabase.from('patients').select('id').limit(1);
    
    if (error && error.code !== '42P01') { // 42P01 means table doesn't exist, which is fine
      console.error('❌ Failed to connect to Supabase:', error);
      return false;
    }
    
    console.log('✅ Successfully connected to Supabase!');
    return true;
  } catch (error) {
    console.error('❌ Error testing Supabase connection:', error);
    return false;
  }
}

async function testGetPatients() {
  try {
    console.log('\nTesting patients retrieval...');
    
    const { data: patients, error } = await supabase
      .from('patients')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('❌ Error getting patients from Supabase:', error);
      return false;
    }
    
    console.log(`✅ Successfully retrieved ${patients?.length || 0} patients`);
    if (patients && patients.length > 0) {
      console.log('First patient:', patients[0]);
    }
    
    return true;
  } catch (error) {
    console.error('❌ Error getting patients from Supabase:', error);
    return false;
  }
}

async function testGetNotes(patientId: string) {
  try {
    console.log(`\nTesting notes retrieval for patient ${patientId}...`);
    
    const { data: notes, error } = await supabase
      .from('notes')
      .select('*')
      .eq('patient_id', patientId)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error(`❌ Error getting notes for patient ${patientId} from Supabase:`, error);
      return false;
    }
    
    console.log(`✅ Successfully retrieved ${notes?.length || 0} notes for patient ${patientId}`);
    if (notes && notes.length > 0) {
      console.log('First note ID:', notes[0].id);
    }
    
    return true;
  } catch (error) {
    console.error(`❌ Error getting notes for patient ${patientId} from Supabase:`, error);
    return false;
  }
}

async function testGetAppSettings() {
  try {
    console.log('\nTesting app settings retrieval...');
    
    const { data: settings, error } = await supabase
      .from('app_settings')
      .select('*')
      .eq('id', 'default')
      .single();
    
    if (error) {
      console.error('❌ Error getting app settings from Supabase:', error);
      return false;
    }
    
    if (settings) {
      console.log('✅ Successfully retrieved app settings');
      console.log('Settings:', settings);
      return true;
    } else {
      console.log('❌ No settings found in Supabase');
      return false;
    }
  } catch (error) {
    console.error('❌ Error getting app settings from Supabase:', error);
    return false;
  }
}

async function runTests() {
  // Test Supabase connection
  const isConnected = await testSupabaseConnection();
  
  if (!isConnected) {
    console.error('Aborting further tests due to connection failure');
    return;
  }
  
  // Test getting patients
  const patientsSuccess = await testGetPatients();
  
  // Test getting notes for first patient, if patients were successfully retrieved
  if (patientsSuccess) {
    const { data: patients } = await supabase
      .from('patients')
      .select('*')
      .order('created_at', { ascending: false });
      
    if (patients && patients.length > 0) {
      await testGetNotes(patients[0].id);
    } else {
      console.log('Skipping notes test - no patients available');
    }
  }
  
  // Test getting app settings
  await testGetAppSettings();
  
  console.log('\nAll tests completed!');
}

// Run all tests
runTests();
