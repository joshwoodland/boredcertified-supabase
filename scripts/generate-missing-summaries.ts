import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import { checkSupabaseConnection, convertToPrismaFormat } from '@/app/lib/supabase';

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

// Initialize OpenAI client
const openai = new OpenAI();

async function generateSummary(content: string, model: string): Promise<string> {
  try {
    const completion = await openai.chat.completions.create({
      model: model || 'gpt-4-turbo-preview',
      messages: [
        {
          role: 'system',
          content: 'You are a medical scribe assistant. Your task is to generate a concise summary of the medical note, focusing on key changes in medications, diagnoses, and treatment plans.'
        },
        {
          role: 'user',
          content: `Please provide a concise summary of this medical note, focusing on key changes in medications, diagnoses, and treatment plans:\n\n${content}`
        }
      ],
      temperature: 0.3,
      max_tokens: 500
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
    const isSupabaseAvailable = await checkSupabaseConnection();
    
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

    const settings = convertToPrismaFormat(settingsData, 'settings');
    if (!settings) {
      throw new Error('Failed to convert settings data');
    }

    // Get all notes that don't have a summary
    const { data: notesData, error: notesError } = await supabase
      .from('notes')
      .select('*')
      .is('summary', null);

    if (notesError) {
      throw new Error(`Error fetching notes: ${notesError.message}`);
    }

    console.log(`Found ${notesData.length} notes without summaries`);

    // Process notes in sequence to avoid rate limits
    for (const noteData of notesData) {
      try {
        console.log(`Processing note ${noteData.id}...`);
        
        // Extract content for summarization
        let content;
        try {
          // Try to parse JSON content format
          const parsedContent = JSON.parse(noteData.content);
          content = parsedContent.content || noteData.content;
        } catch {
          // If not JSON, use as is
          content = noteData.content;
        }
        
        const summary = await generateSummary(content, settings.gptModel || 'gpt-4-turbo-preview');
        
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