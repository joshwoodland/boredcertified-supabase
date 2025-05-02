// Script to debug provider email filtering issue
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Get environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Validate environment variables
if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables. Make sure NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, and SUPABASE_SERVICE_ROLE_KEY are set in .env');
  process.exit(1);
}

// Create non-admin client with anon key (similar to what's used in browser)
const supabaseAnon = createClient(supabaseUrl, supabaseAnonKey);

// Create admin client with service role key
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

// Email to sign in with or check
const EMAIL = 'joshwoodland@gmail.com';

/**
 * Get all patients using service role (bypassing RLS)
 */
async function getAllPatientsAdmin() {
  try {
    const { data, error } = await supabaseAdmin
      .from('patients')
      .select('id, name, provider_email')
      .order('created_at', { ascending: false });
      
    if (error) throw error;
    
    console.log('All patients in database (admin access):');
    console.table(data);
    
    // Count patients with provider emails
    const withProviderEmail = data.filter(p => p.provider_email).length;
    const withoutProviderEmail = data.filter(p => !p.provider_email).length;
    const withSpecificEmail = data.filter(p => p.provider_email === EMAIL).length;
    
    console.log(`\nPatient provider email stats:`);
    console.log(`- Total patients: ${data.length}`);
    console.log(`- With provider email: ${withProviderEmail}`);
    console.log(`- Without provider email: ${withoutProviderEmail}`);
    console.log(`- Assigned to ${EMAIL}: ${withSpecificEmail}`);
    
    return data;
  } catch (err) {
    console.error('Error getting all patients as admin:', err.message);
    return [];
  }
}

/**
 * Try to sign in with the provided email
 */
async function signInAndTestAccess() {
  try {
    // Use OTP sign-in if available, otherwise this just serves as a debug message
    console.log(`\nAttempting to sign in with ${EMAIL}...`);
    console.log('Note: This is just for debugging - in a real app you would sign in through the UI');
    
    // Check if a session already exists
    const { data: { session } } = await supabaseAnon.auth.getSession();
    
    if (session) {
      console.log(`Already signed in as ${session.user.email}`);
      
      // Now test what patients we can see with this auth
      const { data: patientsData, error: patientsError } = await supabaseAnon
        .from('patients')
        .select('id, name, provider_email')
        .order('created_at', { ascending: false });
        
      if (patientsError) {
        console.error(`Error fetching patients as authenticated user: ${patientsError.message}`);
      } else {
        console.log(`\nPatients visible to ${session.user.email} (with RLS):`);
        console.table(patientsData);
        console.log(`Total patients visible: ${patientsData.length}`);
      }
    } else {
      console.log('No active session, cannot test authenticated access');
    }
  } catch (err) {
    console.error('Error during authentication test:', err.message);
  }
}

/**
 * Fix provider emails if needed
 */
async function fixProviderEmails() {
  try {
    console.log(`\nChecking if patients need provider email assigned...`);
    
    const { data, error } = await supabaseAdmin
      .from('patients')
      .select('id')
      .is('provider_email', null);
      
    if (error) throw error;
    
    if (data.length === 0) {
      console.log('All patients already have a provider email assigned.');
      return;
    }
    
    console.log(`Found ${data.length} patients without provider email. Assigning ${EMAIL}...`);
    
    const { error: updateError } = await supabaseAdmin
      .from('patients')
      .update({ provider_email: EMAIL })
      .is('provider_email', null);
      
    if (updateError) throw updateError;
    
    console.log(`Successfully assigned provider email to ${data.length} patients`);
  } catch (err) {
    console.error('Error fixing provider emails:', err.message);
  }
}

/**
 * Main function
 */
async function main() {
  console.log('==== Supabase Provider Email Filtering Debug ====\n');
  
  // Get all patients as admin
  await getAllPatientsAdmin();
  
  // Check authentication and RLS
  await signInAndTestAccess();
  
  // Fix provider emails if necessary
  await fixProviderEmails();
  
  // Check RLS policies are active
  console.log('\nChecking if Row Level Security policies are active...');
  try {
    const { data, error } = await supabaseAdmin
      .from('pg_policies')
      .select('*');
      
    // This will likely fail due to permissions, but we can check
    if (error) {
      console.log('Note: Cannot directly check RLS policies with the current permissions');
      console.log('Instructions to verify RLS:');
      console.log('1. Go to your Supabase dashboard at:', supabaseUrl);
      console.log('2. Navigate to Authentication > Policies');
      console.log('3. Verify the following policies exist:');
      console.log('   - "Providers can only access their own patients" on the patients table');
      console.log('   - "Providers can only access notes for their own patients" on the notes table');
    } else if (data) {
      console.log('RLS policies found:', data);
    }
  } catch (err) {
    console.error('Error checking RLS policies:', err.message);
  }
  
  console.log('\n==== Debug Complete ====');
  console.log('If you\'re not seeing patients when signed in:');
  console.log('1. Ensure all patients have a provider_email set to your email');
  console.log('2. Verify Row Level Security is enabled with the correct policies');
  console.log('3. Check that you\'re properly authenticated in the application');
}

main();
