// Script to debug note content parsing issues
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

// Create Supabase client with service role to bypass RLS
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const serverSupabase = createClient(supabaseUrl, supabaseServiceKey);

async function testNoteParsing() {
  try {
    console.log('Testing note content parsing...');
    
    // First, get a list of patients
    const { data: patients, error: patientsError } = await serverSupabase
      .from('patients')
      .select('id, name')
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
      
      // Get notes for this patient
      const { data: notes, error: notesError } = await serverSupabase
        .from('notes')
        .select('*')
        .eq('patient_id', patient.id)
        .order('created_at', { ascending: false });
      
      if (notesError) {
        console.error(`Error fetching notes for patient ${patient.id}:`, notesError);
        continue;
      }
      
      console.log(`Found ${notes.length} notes for patient ${patient.id}`);
      
      if (notes.length === 0) continue;
      
      // Focus on the most recent note
      const latestNote = notes[0];
      console.log(`Latest note ID: ${latestNote.id}`);
      console.log(`Created at: ${latestNote.created_at}`);
      console.log(`Is initial visit: ${latestNote.is_initial_visit}`);
      
      // Try parsing the content
      console.log('\nTesting content parsing:');
      console.log(`Content type: ${typeof latestNote.content}`);
      console.log(`Content snippet: ${latestNote.content.substring(0, 100)}...`);
      
      try {
        // Try the same parsing logic as in the app
        console.log('\nParsing using app logic:');
        const parsedContent = JSON.parse(latestNote.content);
        console.log(`Parsed content structure: ${Object.keys(parsedContent).join(', ')}`);
        
        let previousContent = '';
        
        if (typeof parsedContent.content === 'string') {
          console.log('SUCCESS: Found parsedContent.content as string');
          previousContent = parsedContent.content;
          console.log(`Content snippet: ${previousContent.substring(0, 100)}...`);
        } else if (parsedContent.content) {
          console.log('Found parsedContent.content as non-string:');
          console.log(`Type: ${typeof parsedContent.content}`);
          previousContent = JSON.stringify(parsedContent.content);
          console.log(`Stringified content snippet: ${previousContent.substring(0, 100)}...`);
        } else {
          console.log('No parsedContent.content found, using entire parsed object:');
          previousContent = JSON.stringify(parsedContent);
          console.log(`Stringified content snippet: ${previousContent.substring(0, 100)}...`);
        }
        
        // Check for formattedContent which might be used
        if (parsedContent.formattedContent) {
          console.log('\nFound formattedContent field:');
          console.log(`Type: ${typeof parsedContent.formattedContent}`);
          console.log(`Content snippet: ${JSON.stringify(parsedContent.formattedContent).substring(0, 100)}...`);
        }
        
        // Simulate what happens in the app
        console.log('\nSimulating enhanced transcript creation:');
        const enhancedTranscript = `Sample transcript\n\n ##( Here is the note from the patient's previous visit to be used for greater context: ${previousContent} )`;
        console.log('Enhanced transcript created successfully');
        
      } catch (e) {
        console.error('ERROR parsing note content:', e);
        console.log('Raw content:', latestNote.content);
      }
    }
    
  } catch (error) {
    console.error('Error in test:', error);
  }
}

// Run test function
testNoteParsing()
  .then(() => console.log('\nTest completed'))
  .catch(err => console.error('Test failed:', err));
