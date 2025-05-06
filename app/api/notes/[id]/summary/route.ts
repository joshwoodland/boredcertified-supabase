import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { getCurrentModel } from '@/app/utils/modelCache';
import { checkSupabaseConnection, supabase, convertToPrismaFormat } from '@/app/lib/supabase';

const openai = new OpenAI();

// Simplified handler using only the request parameter
export async function POST(
  request: NextRequest
) {
  try {
    // Extract the ID from the URL path
    const url = new URL(request.url);
    const pathSegments = url.pathname.split('/');
    const noteId = pathSegments[pathSegments.indexOf('notes') + 1];

    if (!noteId) {
      return NextResponse.json({ error: 'Note ID not found in URL' }, { status: 400 });
    }

    // Check if Supabase is available
    const isSupabaseAvailable = await checkSupabaseConnection();
    
    if (!isSupabaseAvailable) {
      return NextResponse.json({
        error: 'Database connection unavailable',
        details: 'Please check your database connection settings.'
      }, { status: 503 });
    }

    // Find the note
    const { data: noteData, error: noteError } = await supabase
      .from('notes')
      .select('*')
      .eq('id', noteId)
      .single();

    if (noteError) {
      console.error('Error fetching note from Supabase:', noteError);
      return NextResponse.json({ 
        error: 'Failed to fetch note', 
        details: noteError.message 
      }, { status: 500 });
    }

    if (!noteData) {
      return NextResponse.json({ error: 'Note not found' }, { status: 404 });
    }

    const note = convertToPrismaFormat(noteData, 'note');
    if (!note) {
      return NextResponse.json({ 
        error: 'Failed to convert note data', 
        details: 'Error converting note format' 
      }, { status: 500 });
    }

    // If note already has a summary, return it
    if (note.summary) {
      return NextResponse.json({ summary: note.summary });
    }

    // Extract content for summarization
    let content;
    try {
      // Try to parse JSON content format
      const parsedContent = JSON.parse(note.content || '');
      content = parsedContent.content || String(note.content || '');
    } catch {
      // If not JSON, use as is
      content = String(note.content || '');
    }

    // Get current model
    const model = await getCurrentModel();

    // Call OpenAI to generate summary
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

    const summary = completion.choices[0]?.message?.content;

    if (!summary) {
      return NextResponse.json({ error: 'Failed to generate summary' }, { status: 500 });
    }

    // Update the note with the summary
    const { error: updateError } = await supabase
      .from('notes')
      .update({ 
        summary,
        updated_at: new Date().toISOString()
      })
      .eq('id', noteId);

    if (updateError) {
      console.error('Error updating note summary in Supabase:', updateError);
      return NextResponse.json({ 
        error: 'Failed to save summary', 
        details: updateError.message 
      }, { status: 500 });
    }

    return NextResponse.json({ summary });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({
      error: 'Failed to process summary',
      details: error instanceof Error ? error.message : 'Unknown error occurred'
    }, { status: 500 });
  }
} 