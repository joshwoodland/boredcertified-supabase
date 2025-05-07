// Simple script to debug Supabase note retrieval issues
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

// Check environment variables
console.log('Checking environment variables:');
const envVars = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY'
];

const missingVars = envVars.filter(varName => !process.env[varName]);
if (missingVars.length > 0) {
  console.error(`❌ Missing environment variables: ${missingVars.join(', ')}`);
  process.exit(1);
}

console.log('✅ All required environment variables are present');

// Create Supabase clients
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log(`Creating Supabase clients with URL: ${supabaseUrl}`);

// Create both regular and service role clients for comparison
const supabase = createClient(supabaseUrl, supabaseAnonKey);
const serverSupabase = createClient(supabaseUrl, supabaseServiceKey);

async function runDiagnostics() {
  console.log('\n--- DIAGNOSTICS START ---\n');
  
  // Test basic connectivity
  console.log('1. Testing basic Supabase connectivity...');
  try {
    const { data, error } = await serverSupabase.from('patients').select('count').limit(1);
    if (error) {
      console.error('❌ Failed to connect to Supabase:', error);
    } else {
      console.log('✅ Successfully connected to Supabase using service role');
    }
  } catch (err) {
    console.error('❌ Error connecting to Supabase:', err);
  }

  // Get list of all patients (using service role to bypass RLS)
  console.log('\n2. Fetching all patients using service role...');
  try {
    const { data: patients, error } = await serverSupabase
      .from('patients')
      .select('id, name, provider_email')
      .order('name')
      .limit(10);
    
    if (error) {
      console.error('❌ Failed to fetch patients:', error);
    } else {
      console.log(`✅ Found ${patients.length} patients`);
      
      if (patients.length > 0) {
        console.log('Sample patients:');
        patients.forEach(p => console.log(` - ${p.name} (ID: ${p.id}, Provider: ${p.provider_email || 'none'})`));
        
        // Use the first patient for note testing
        const testPatientId = patients[0].id;
        await testPatientNotes(testPatientId);
      } else {
        console.log('❌ No patients found to test with');
      }
    }
  } catch (err) {
    console.error('❌ Error fetching patients:', err);
  }

  console.log('\n--- DIAGNOSTICS COMPLETE ---');
}

async function testPatientNotes(patientId) {
  console.log(`\n3. Testing note retrieval for patient ID: ${patientId}`);
  
  // Try with anon key first (like a browser would)
  console.log('\n3.1. Fetching notes with anonymous key (like browser)...');
  try {
    const { data: anonNotes, error: anonError } = await supabase
      .from('notes')
      .select('*')
      .eq('patient_id', patientId)
      .order('created_at', { ascending: false });
    
    if (anonError) {
      console.error('❌ Failed to fetch notes with anon key:', anonError);
      console.log('   This could be due to Row Level Security (RLS) policies');
    } else {
      console.log(`✅ Found ${anonNotes.length} notes with anon key`);
      if (anonNotes.length > 0) {
        console.log(`   First note ID: ${anonNotes[0].id}`);
        console.log(`   Is initial visit: ${anonNotes[0].is_initial_visit}`);
        console.log(`   Content snippet: ${anonNotes[0].content.substring(0, 100)}...`);
      }
    }
  } catch (err) {
    console.error('❌ Error fetching notes with anon key:', err);
  }
  
  // Now try with service role (bypassing RLS)
  console.log('\n3.2. Fetching notes with service role (bypassing RLS)...');
  try {
    const { data: serviceNotes, error: serviceError } = await serverSupabase
      .from('notes')
      .select('*')
      .eq('patient_id', patientId)
      .order('created_at', { ascending: false });
    
    if (serviceError) {
      console.error('❌ Failed to fetch notes with service role:', serviceError);
    } else {
      console.log(`✅ Found ${serviceNotes.length} notes with service role`);
      
      if (serviceNotes.length > 0) {
        console.log('First note details:');
        const note = serviceNotes[0];
        console.log(` - ID: ${note.id}`);
        console.log(` - Created: ${note.created_at}`);
        console.log(` - Is initial visit: ${note.is_initial_visit}`);
        console.log(` - Content type: ${typeof note.content}`);
        
        // Try to parse content
        try {
          const contentSample = note.content.substring(0, 100) + '...';
          console.log(` - Content snippet: ${contentSample}`);
          
          const parsedContent = JSON.parse(note.content);
          console.log(` - Parsed content keys: ${Object.keys(parsedContent).join(', ')}`);
          
          if (parsedContent.content) {
            const contentType = typeof parsedContent.content;
            console.log(` - parsedContent.content type: ${contentType}`);
            
            if (contentType === 'string') {
              console.log(` - parsedContent.content snippet: ${parsedContent.content.substring(0, 100)}...`);
            } else {
              console.log(` - parsedContent.content is not a string: ${JSON.stringify(parsedContent.content).substring(0, 100)}...`);
            }
          }
        } catch (parseErr) {
          console.error(` - ❌ Error parsing note content: ${parseErr.message}`);
        }
      }
    }
  } catch (err) {
    console.error('❌ Error fetching notes with service role:', err);
  }
  
  // Test the specific code that might be failing
  console.log('\n3.3. Testing the specific note retrieval logic that might be failing...');
  try {
    console.log('Fetching most recent note for this patient...');
    const { data: noteData, error: noteError } = await serverSupabase
      .from('notes')
      .select('content, id, created_at')
      .eq('patient_id', patientId)
      .order('created_at', { ascending: false })
      .limit(1);

    if (noteError) {
      console.error('❌ Error fetching previous note:', noteError);
    } else if (noteData && noteData.length > 0) {
      console.log(`✅ Found note ID: ${noteData[0].id}, created at: ${noteData[0].created_at}`);
      console.log(`Content type: ${typeof noteData[0].content}`);
      
      try {
        // Try to parse the content, which might be in JSON format
        console.log('Attempting to parse note content as JSON');
        const parsedContent = JSON.parse(noteData[0].content);
        console.log('Parsed content structure:', Object.keys(parsedContent));
        
        // If it has a content property, use that, otherwise use the whole parsed object
        let previousContent = '';
        if (typeof parsedContent.content === 'string') {
          console.log('✅ Using parsedContent.content (string)');
          previousContent = parsedContent.content;
        } else if (parsedContent.content) {
          console.log('✅ Using stringified parsedContent.content (object)');
          previousContent = JSON.stringify(parsedContent.content);
        } else {
          console.log('✅ Using entire parsedContent');
          previousContent = JSON.stringify(parsedContent);
        }
        
        console.log(`Previous content snippet: ${previousContent.substring(0, 100)}...`);
        
        // This would be the format used to add to the transcript
        const enhancedTranscript = `Sample transcript\n\n ##( Here is the note from the patient's previous visit to be used for greater context: ${previousContent} )`;
        console.log('Successfully created enhanced transcript format');
      } catch (e) {
        // If parsing fails, use the content as is
        console.error('❌ Error parsing note content:', e);
        console.log('Using raw content as fallback');
        console.log(`Raw content snippet: ${noteData[0].content.substring(0, 100)}...`);
      }
    } else {
      console.warn('⚠️ No previous notes found for this patient');
    }
  } catch (error) {
    console.error('❌ Error in test code:', error);
  }
}

// Run all tests
runDiagnostics().catch(console.error);
