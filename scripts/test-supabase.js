// Simple script to test Supabase connection and utility functions
require('dotenv').config({ path: '.env.local' });
const { supabase, checkSupabaseConnection, getSupabasePatients, getSupabaseNotes, getSupabaseAppSettings } = require('../app/lib/supabase');

async function testSupabaseConnection() {
  try {
    console.log('Testing Supabase connection...');
    const isConnected = await checkSupabaseConnection();
    
    if (isConnected) {
      console.log('✅ Successfully connected to Supabase!');
      return true;
    } else {
      console.error('❌ Failed to connect to Supabase');
      return false;
    }
  } catch (error) {
    console.error('❌ Error testing Supabase connection:', error);
    return false;
  }
}

async function testGetPatients() {
  try {
    console.log('\nTesting getSupabasePatients()...');
    const patients = await getSupabasePatients();
    
    console.log(`✅ Successfully retrieved ${patients.length} patients`);
    if (patients.length > 0) {
      console.log('First patient:', patients[0]);
    }
    
    return true;
  } catch (error) {
    console.error('❌ Error getting patients from Supabase:', error);
    return false;
  }
}

async function testGetNotes(patientId) {
  try {
    console.log(`\nTesting getSupabaseNotes() for patient ${patientId}...`);
    const notes = await getSupabaseNotes(patientId);
    
    console.log(`✅ Successfully retrieved ${notes.length} notes for patient ${patientId}`);
    if (notes.length > 0) {
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
    console.log('\nTesting getSupabaseAppSettings()...');
    const settings = await getSupabaseAppSettings();
    
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
    const patients = await getSupabasePatients();
    if (patients.length > 0) {
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
