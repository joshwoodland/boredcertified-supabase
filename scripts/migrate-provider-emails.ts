// Migration script to assign provider emails to existing patients
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Get environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Validate environment variables
if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables. Make sure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in .env');
  process.exit(1);
}

// Create Supabase client with admin privileges
const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface Patient {
  id: string;
  provider_email: string | null;
}

/**
 * Main migration function
 * @param {string} defaultProviderEmail - The email to assign to patients without a provider
 */
async function migrateProviderEmails(defaultProviderEmail: string): Promise<void> {
  try {
    if (!defaultProviderEmail) {
      console.error('Please provide a default provider email as an argument.');
      console.log('Usage: npx ts-node migrate-provider-emails.ts provider@example.com');
      process.exit(1);
    }

    console.log(`Starting migration to assign provider emails using default: ${defaultProviderEmail}`);
    
    // 1. Count how many patients need updating
    const { data: patients, error: countError } = await supabase
      .from('patients')
      .select('id')
      .is('provider_email', null);
      
    if (countError) {
      throw new Error(`Error counting patients: ${countError.message}`);
    }
    
    console.log(`Found ${patients?.length || 0} patients without a provider email assignment`);
    
    if (!patients || patients.length === 0) {
      console.log('No migration needed. All patients already have a provider email assigned.');
      return;
    }
    
    // 2. Update all patients without a provider_email
    const { data, error: updateError } = await supabase
      .from('patients')
      .update({ provider_email: defaultProviderEmail })
      .is('provider_email', null)
      .select();
      
    if (updateError) {
      throw new Error(`Error updating patients: ${updateError.message}`);
    }
    
    console.log(`Successfully assigned provider email to ${data?.length || 0} patients`);
    console.log('Migration completed successfully!');
    
  } catch (error) {
    console.error('Migration failed:', error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  }
}

// Use joshwoodland@gmail.com as the default provider email
const defaultProviderEmail = process.argv[2] || 'joshwoodland@gmail.com';
migrateProviderEmails(defaultProviderEmail);
