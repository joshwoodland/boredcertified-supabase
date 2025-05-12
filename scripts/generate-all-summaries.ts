import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import { convertToAppFormat } from '@/app/lib/supabaseTypes';

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

// Helper function to check Supabase connection
async function checkSupabaseConnection(supabaseClient: any): Promise<boolean> {
  try {
    const { data, error } = await supabaseClient.from('patients').select('id').limit(1);
    if (error && error.code !== '42P01') { // 42P01 means table doesn't exist, which is fine
      console.error('Supabase connection error:', error);
      return false;
    }
    return true;
  } catch (error) {
    console.error('Failed to connect to Supabase:', error);
    return false;
  }
}

// Initialize OpenAI client
const openai = new OpenAI();

async function generateSummary(content: string, model: string): Promise<string> {
  try {
    const completion = await openai.chat.completions.create({
      model: model || 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a medical scribe assistant. Create very concise summaries that prioritize medication changes.'
        },
        {
          role: 'user',
          content: `Create a brief clinical headline (30-40 words max) summarizing this note. PRIORITIZE any medication changes, then other key clinical information. DO NOT include patient names or identifiers:\n\n${content}`
        }
      ],
      temperature: 0.3,
      max_tokens: 200
    });

    return completion.choices[0]?.message?.content || '';
  } catch (error) {
    console.error('Error generating summary:', error);
    throw error;
  }
}

async function main() {
  try {
    // Check if Supabase is available
    const isSupabaseAvailable = await checkSupabaseConnection(supabase);

    if (!isSupabaseAvailable) {
      throw new Error('Supabase connection unavailable. Please check your connection settings.');
    }

    // Get current settings
    const { data: settingsData, error: settingsError } = await supabase
      .from('app_settings')
      .select('*')
      .eq('id', 'default')
      .single();

    if (settingsError) {
      throw new Error(`Error fetching settings: ${settingsError.message}`);
    }

    const settings = convertToAppFormat(settingsData, 'settings');
    if (!settings || !('gptModel' in settings)) {
      throw new Error('Failed to convert settings data or invalid settings format');
    }

    // TypeScript type assertion to ensure gptModel is available
    const typedSettings = settings as { gptModel: string };

    // Get all notes without summaries
    const { data: notesData, error: notesError } = await supabase
      .from('notes')
      .select('*')
      .or('summary.is.null,summary.eq.,summary.eq.""');

    if (notesError) {
      throw new Error(`Error fetching notes: ${notesError.message}`);
    }

    console.log(`Found ${notesData.length} notes without summaries`);

    // Process notes in sequence to avoid rate limits
    for (const noteData of notesData) {
      try {
        console.log(`Processing note ${noteData.id}...`);

        // Extract content for summarization
        let content: string;
        try {
          // Try to parse JSON content format
          const parsedContent = JSON.parse(noteData.content);
          content = parsedContent.content || noteData.content;
        } catch {
          // If not JSON, use as is
          content = noteData.content;
        }

        // Skip if note already has a non-empty summary
        if (noteData.summary && noteData.summary.trim() !== '') {
          console.log(`Skipping note ${noteData.id} - already has summary`);
          continue;
        }
        
        const summary = await generateSummary(content, typedSettings.gptModel || 'gpt-4o-mini');

        // Update the note with the summary
        const { error: updateError } = await supabase
          .from('notes')
          .update({
            summary,
            updated_at: new Date().toISOString()
          })
          .eq('id', noteData.id);

        if (updateError) {
          throw new Error(`Error updating note: ${updateError.message}`);
        }

        console.log(`✓ Generated summary for note ${noteData.id}`);

        // Add a small delay to avoid hitting rate limits
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        console.error(`Failed to process note ${noteData.id}:`, error);
      }
    }

    console.log('Finished generating summaries');
  } catch (error) {
    console.error('Error:', error);
  }
}

main();
