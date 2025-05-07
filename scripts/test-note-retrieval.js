// Script to test the note retrieval functionality used in the app
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

// Create Supabase clients with both anon and service role keys to compare
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);
const serverSupabase = createClient(supabaseUrl, supabaseServiceKey);

async function testExactAppLogic() {
  try {
    console.log('Testing exact app logic for note retrieval...');
    
    // Get a list of patients using service role (to ensure we get some results)
    const { data: patients, error: patientsError } = await serverSupabase
      .from('patients')
      .select('id, name, provider_email')
      .limit(5);
    
    if (patientsError) {
      console.error('Error fetching patients:', patientsError);
      return;
    }
    
    console.log(`Found ${patients.length} patients`);
    
    // Test with each patient
    for (const patient of patients) {
      console.log(`\n------------------------------`);
      console.log(`Testing patient: ${patient.name} (${patient.id})`);
      console.log(`Provider email: ${patient.provider_email || 'none'}`);
      
      // First, count existing notes using the exact app logic
      console.log('\n1. Testing note count logic:');
      const { count, error: countError } = await supabase
        .from('notes')
        .select('id', { count: 'exact', head: true })
        .eq('patient_id', patient.id);
        
      if (countError) {
        console.error(`Error counting notes for patient ${patient.id}:`, countError);
      } else {
        console.log(`Notes count using regular client: ${count || 0}`);
      }
      
      // Compare with server role to see if there's an RLS issue
      const { count: serverCount, error: serverCountError } = await serverSupabase
        .from('notes')
        .select('id', { count: 'exact', head: true })
        .eq('patient_id', patient.id);
        
      if (serverCountError) {
        console.error(`Error counting notes (server role) for patient ${patient.id}:`, serverCountError);
      } else {
        console.log(`Notes count using service role: ${serverCount || 0}`);
        
        if (count !== serverCount) {
          console.warn('MISMATCH: Regular client and service role returned different counts!');
          console.warn('This indicates a possible Row Level Security (RLS) issue');
        }
      }
      
      // Now test the previous note retrieval logic
      console.log('\n2. Testing previous note retrieval:');
      
      // First try with regular client (like the app would)
      const { data: noteData, error: noteError } = await supabase
        .from('notes')
        .select('content, id, created_at')
        .eq('patient_id', patient.id)
        .order('created_at', { ascending: false })
        .limit(1);

      if (noteError) {
        console.error('Error fetching previous note with regular client:', noteError);
      } else if (noteData && noteData.length > 0) {
        console.log(`Found previous note with regular client: ${noteData[0].id}`);
        
        // Now try to parse the content
        try {
          console.log('Attempting to parse note content as JSON');
          const parsedContent = JSON.parse(noteData[0].content);
          console.log('Parsed content structure:', Object.keys(parsedContent));
          
          // If it has a content property, use that, otherwise use the whole parsed object
          let previousContent = '';
          if (typeof parsedContent.content === 'string') {
            console.log('Using parsedContent.content (string)');
            previousContent = parsedContent.content;
          } else if (parsedContent.content) {
            console.log('Using stringified parsedContent.content (object)');
            previousContent = JSON.stringify(parsedContent.content);
          } else {
            console.log('Using entire parsedContent');
            previousContent = JSON.stringify(parsedContent);
          }
          
          // This would be what's added to the transcript in the app
          console.log('Successfully created enhanced transcript');
        } catch (e) {
          console.error('Error parsing note content:', e);
          console.log('Raw content:', noteData[0].content.substring(0, 100) + '...');
        }
      } else {
        console.log('No notes found with regular client');
      }
      
      // Now try with server role
      const { data: serverNoteData, error: serverNoteError } = await serverSupabase
        .from('notes')
        .select('content, id, created_at')
        .eq('patient_id', patient.id)
        .order('created_at', { ascending: false })
        .limit(1);

      if (serverNoteError) {
        console.error('Error fetching previous note with service role:', serverNoteError);
      } else if (serverNoteData && serverNoteData.length > 0) {
        console.log(`Found previous note with service role: ${serverNoteData[0].id}`);
        
        // Check if there's a mismatch between regular and service role results
        if ((!noteData || noteData.length === 0) && serverNoteData.length > 0) {
          console.error('CRITICAL ISSUE: Service role found notes that regular client cannot access!');
          console.error('This indicates a Row Level Security (RLS) issue that needs to be fixed');
        }
      } else {
        console.log('No notes found with service role');
      }
    }
    
    console.log('\n------------------------------');
    console.log('Testing completed!');
  } catch (error) {
    console.error('Error in test:', error);
  }
}

// Run the test
testExactAppLogic().catch(console.error);
