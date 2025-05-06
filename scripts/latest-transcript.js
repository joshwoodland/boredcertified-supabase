const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config({ path: '.env.local' });

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  try {
    // Get the 5 most recent notes
    const { data: recentNotes, error: notesError } = await supabase
      .from('notes')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5);

    if (notesError) {
      console.error('Error fetching notes:', notesError);
      return;
    }

    if (!recentNotes || recentNotes.length === 0) {
      console.log('No notes found');
      return;
    }

    // Print each note's transcript
    recentNotes.forEach((note, index) => {
      console.log(`\nNote ${index + 1} (${new Date(note.created_at).toLocaleString()}):`);
      console.log('Transcript:', note.transcript);
      console.log('Content:', note.content);
      console.log('Summary:', note.summary);
      console.log('-'.repeat(80));
    });
  } catch (error) {
    console.error('Error:', error);
  }
}

main(); 