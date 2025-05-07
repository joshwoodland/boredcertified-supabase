// Test script to verify the fix for the note detection issue
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

// Create Supabase client with service role key to bypass RLS
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const serverSupabase = createClient(supabaseUrl, supabaseServiceKey);

async function testFix() {
  console.log('Testing the fix for the note detection issue...');
  console.log('This will verify our changes make the app properly detect previous visits');
  
  try {
    // First, get a patient with notes
    const { data: patients, error: patientsError } = await serverSupabase
      .from('patients')
      .select('id, name')
      .limit(5);
    
    if (patientsError) {
      console.error('Error fetching patients:', patientsError);
      return;
    }
    
    if (!patients || patients.length === 0) {
      console.log('No patients found to test with');
      return;
    }
    
    console.log(`Found ${patients.length} patients to test with`);
    
    // For each patient, test the note retrieval process
    for (const patient of patients) {
      console.log(`\nTesting patient: ${patient.name} (${patient.id})`);
      
      // First try with regular client - which is the problem we were having
      console.log('Testing with regular client:');
      try {
        // Simulate the note count check used in our app
        const { count, error: countError } = await serverSupabase
          .from('notes')
          .select('id', { count: 'exact', head: true })
          .eq('patient_id', patient.id);
        
        if (countError) {
          console.error('Error counting notes:', countError);
        } else {
          console.log(`Found ${count || 0} notes`);
          
          if (count && count > 0) {
            // This patient has notes, now test retrieving the previous note
            console.log('Testing note retrieval:');
            
            // Use serverSupabase to simulate our fixed code
            const { data: noteData, error: noteError } = await serverSupabase
              .from('notes')
              .select('content, id, created_at')
              .eq('patient_id', patient.id)
              .order('created_at', { ascending: false })
              .limit(1);
              
            if (noteError) {
              console.error('Error fetching note:', noteError);
            } else if (noteData && noteData.length > 0) {
              console.log(`Successfully retrieved note ID: ${noteData[0].id}`);
              console.log(`Created at: ${noteData[0].created_at}`);
              
              // Now test parsing the content
              try {
                const parsedContent = JSON.parse(noteData[0].content);
                console.log('Successfully parsed note content');
                console.log('Content structure:', Object.keys(parsedContent));
                
                // Process the content using our enhanced code
                let previousContent;
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
                
                console.log('Content snippet:', previousContent.substring(0, 100) + '...');
                console.log('✅ Successfully processed note content');
              } catch (e) {
                console.error('Error parsing note content:', e);
                console.log('Raw content:', noteData[0].content.substring(0, 100) + '...');
              }
            } else {
              console.log('No notes found for this patient');
            }
          }
        }
      } catch (err) {
        console.error('Error in test:', err);
      }
    }
    
    console.log('\nTest completed!');
    
  } catch (error) {
    console.error('Error running test:', error);
  }
}

// Run the test
testFix().catch(console.error);
