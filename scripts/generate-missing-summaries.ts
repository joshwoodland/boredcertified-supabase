import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import { checkSupabaseConnection } from '@/app/lib/supabase';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function generateSummary(content: string, isInitialVisit: boolean) {
  try {
    // Get settings for the prompts
    const { data: settings, error: settingsError } = await supabase
      .from('app_settings')
      .select('*')
      .eq('id', 'default')
      .single();

    if (settingsError) {
      console.error('Error fetching settings:', settingsError);
      return null;
    }

    const prompt = isInitialVisit ? settings.initial_visit_prompt : settings.follow_up_visit_prompt;

    const completion = await openai.chat.completions.create({
      model: settings.gpt_model || 'gpt-4',
      messages: [
        { role: 'system', content: prompt },
        { role: 'user', content }
      ],
      temperature: 0.7,
      max_tokens: 500
    });

    return completion.choices[0]?.message?.content || null;
  } catch (error) {
    console.error('Error generating summary:', error);
    return null;
  }
}

async function main() {
  try {
    // Check Supabase connection
    const isConnected = await checkSupabaseConnection();
    if (!isConnected) {
      throw new Error('Could not connect to Supabase');
    }

    // Get all notes without summaries
    const { data: notes, error: notesError } = await supabase
      .from('notes')
      .select('*')
      .is('summary', null);

    if (notesError) {
      throw new Error(`Error fetching notes: ${notesError.message}`);
    }

    if (!notes || notes.length === 0) {
      console.log('No notes found without summaries');
      return;
    }

    console.log(`Found ${notes.length} notes without summaries`);

    // Process each note
    for (const note of notes) {
      console.log(`Processing note ${note.id}...`);

      // Generate summary
      const summary = await generateSummary(note.content, note.is_initial_visit);

      if (summary) {
        // Update note with summary
        const { error: updateError } = await supabase
          .from('notes')
          .update({ summary })
          .eq('id', note.id);

        if (updateError) {
          console.error(`Error updating note ${note.id}:`, updateError);
          continue;
        }

        console.log(`Updated note ${note.id} with summary`);
      } else {
        console.error(`Failed to generate summary for note ${note.id}`);
      }
    }

    console.log('Finished processing notes');
  } catch (error) {
    console.error('Error in main:', error);
  }
}

// Run the script
main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  }); 