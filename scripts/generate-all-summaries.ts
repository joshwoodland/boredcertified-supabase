import { createClient } from '@supabase/supabase-js';
import { convertToAppFormat } from '@/app/lib/supabaseTypes';
import { extractContent } from '@/app/utils/safeJsonParse';
import OpenAI from 'openai';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

// Load environment variables from .env.local
dotenv.config({ path: resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const openaiApiKey = process.env.OPENAI_API_KEY;

if (!supabaseUrl || !supabaseServiceKey || !openaiApiKey) {
  console.error('Missing required environment variables');
  console.error('Please ensure NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and OPENAI_API_KEY are set in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);
const openai = new OpenAI({ apiKey: openaiApiKey });

async function generateSummaryForNote(noteId: string, content: string): Promise<string | null> {
  try {
    // Extract the actual content from the stored JSON
    const noteContent = extractContent(content);
    
    if (!noteContent || noteContent.trim() === '') {
      console.error(`No content found for note ${noteId}`);
      return null;
    }

    const prompt = `Create a very concise summary (30-40 words max) of this medical note. PRIORITIZE any medication changes, then other key clinical information. DO NOT include patient names or identifiers:

${noteContent}`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens: 200,
    });

    const summary = response.choices[0]?.message?.content?.trim() || '';
    
    if (!summary) {
      console.error(`OpenAI returned empty summary for note ${noteId}`);
      return null;
    }

    return summary;
  } catch (error) {
    console.error(`Error generating summary for note ${noteId}:`, error);
    return null;
  }
}

async function generateAllSummaries() {
  console.log('Starting summary generation for all notes without summaries...\n');

  // Fetch all notes without summaries
  const { data: notes, error } = await supabase
    .from('notes')
    .select('id, content, summary')
    .or('summary.is.null,summary.eq.""')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching notes:', error);
    process.exit(1);
  }

  if (!notes || notes.length === 0) {
    console.log('No notes found without summaries. All done!');
    return;
  }

  console.log(`Found ${notes.length} notes without summaries.\n`);

  let successCount = 0;
  let failureCount = 0;

  // Process notes with rate limiting
  for (let i = 0; i < notes.length; i++) {
    const note = notes[i];
    console.log(`Processing note ${i + 1}/${notes.length} (ID: ${note.id})...`);

    const summary = await generateSummaryForNote(note.id, note.content);

    if (summary) {
      // Update the note with the summary
      const { error: updateError } = await supabase
        .from('notes')
        .update({
          summary,
          updated_at: new Date().toISOString(),
        })
        .eq('id', note.id);

      if (updateError) {
        console.error(`Failed to update note ${note.id}:`, updateError);
        failureCount++;
      } else {
        console.log(`✓ Successfully generated summary for note ${note.id}`);
        successCount++;
      }
    } else {
      console.error(`✗ Failed to generate summary for note ${note.id}`);
      failureCount++;
    }

    // Add a small delay to avoid rate limiting
    if (i < notes.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  console.log(`\nSummary generation complete!`);
  console.log(`Success: ${successCount}`);
  console.log(`Failures: ${failureCount}`);
  console.log(`Total processed: ${notes.length}`);

  // Fetch and display settings info
  const { data: settingsData } = await supabase
    .from('settings')
    .select('*')
    .single();

  if (settingsData) {
    const settings = convertToAppFormat(settingsData, 'settings');
    if (settings && 'gptModel' in settings) {
      console.log(`\nSettings used for generation:`);
      console.log(`- GPT Model: ${settings.gptModel || 'gpt-4o-mini'}`);
    }
  }
}

// Run the script
generateAllSummaries().catch(console.error);
