/**
 * @file app/api/notes/[id]/route.ts
 * @description Consolidated API route handler for note operations:
 * - GET: Fetch a specific note by ID
 * - PUT: Update a note (content and/or summary)
 * - POST: Generate and save a summary for a note
 * - DELETE: Delete a note by ID
 */

import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { createClient } from '@/app/utils/supabase/server';
import { convertToAppFormat, type AppNote } from '@/app/lib/supabaseTypes';
import { extractContent } from '@/app/utils/safeJsonParse';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Helper function to check Supabase connection
async function checkSupabaseConnection(): Promise<boolean> {
  try {
    const supabase = createClient();
    if (!supabase) {
      console.error('[notes/[id]/route] Failed to initialize Supabase client');
      return false;
    }

    const { error } = await supabase.from('notes').select('id').limit(1);
    if (error && error.code !== '42P01') { // 42P01 means table doesn't exist, which is fine
      console.error('[notes/[id]/route] Supabase connection error:', error);
      return false;
    }
    return true;
  } catch (error) {
    console.error('[notes/[id]/route] Failed to connect to Supabase:', error);
    return false;
  }
}

/**
 * GET handler for fetching a specific note by ID
 */
export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    // Get the note ID from route parameters
    const params = await context.params;
    const noteId = params.id;

    if (!noteId) {
      return NextResponse.json({ error: 'Note ID not found in URL' }, { status: 400 });
    }

    // Check if Supabase is available
    const isSupabaseAvailable = await checkSupabaseConnection();
    if (!isSupabaseAvailable) {
      return NextResponse.json(
        {
          error: 'Database connection unavailable',
          details: 'Please check your database connection settings.',
        },
        { status: 503 }
      );
    }

    // Use standardized client initialization
    const supabase = createClient();
    if (!supabase) {
      return NextResponse.json(
        { error: 'Failed to initialize database client' },
        { status: 500 }
      );
    }

    // Get the note from Supabase - first check if it exists
    console.log(`[notes/[id]/route] Fetching note with ID: ${noteId}`);
    const { data: notes, error } = await supabase
      .from('notes')
      .select('*')
      .eq('id', noteId);

    if (error) {
      console.error('[notes/[id]/route] Error fetching note:', error);
      return NextResponse.json(
        { error: 'Failed to fetch note', details: error.message },
        { status: 500 }
      );
    }

    if (!notes || notes.length === 0) {
      console.error(`[notes/[id]/route] Note with ID ${noteId} not found`);
      return NextResponse.json(
        { error: 'Note not found', details: `No note exists with ID: ${noteId}` },
        { status: 404 }
      );
    }

    if (notes.length > 1) {
      console.error(`[notes/[id]/route] Multiple notes found with ID ${noteId}`);
      return NextResponse.json(
        { error: 'Data integrity error', details: `Multiple notes found with ID: ${noteId}` },
        { status: 500 }
      );
    }

    const note = notes[0];

    // Check if a summary already exists
    if (note.summary && note.summary.trim() !== '') {
      console.log(`[notes/[id]/route] Found existing summary for note ${noteId}`);
      // Convert to app format and return existing summary
      const appNote = convertToAppFormat(note, 'note') as AppNote;
      return NextResponse.json(appNote);
    }

    console.log(`[notes/[id]/route] No existing summary found for note ${noteId}. Generating new summary.`);

    // Extract the actual content from the note
    const noteContent = extractContent(note.content);
    
    if (!noteContent || noteContent.trim() === '') {
      console.error(`[notes/[id]/route] No content found for note ${noteId}`);
      return NextResponse.json(
        { error: 'No content available to generate summary' },
        { status: 400 }
      );
    }

    // Generate summary using OpenAI
    const prompt = `Create a very concise summary (30-40 words max) of this medical note. PRIORITIZE any medication changes, then other key clinical information. DO NOT include patient names or identifiers:

${noteContent}`;
    
    let summary = '';
    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 200,
      });

      summary = response.choices[0]?.message?.content?.trim() || '';
      
      if (!summary) {
        console.error(`[notes/[id]/route] OpenAI returned empty summary for note ${noteId}`);
      }
    } catch (openaiError) {
      console.error(`[notes/[id]/route] OpenAI API error for note ${noteId}:`, openaiError);
      return NextResponse.json(
        { 
          error: 'Failed to generate summary', 
          details: openaiError instanceof Error ? openaiError.message : 'OpenAI API error'
        },
        { status: 500 }
      );
    }

    // Update the note with the summary
    const { data: updatedNote, error: updateError } = await supabase
      .from('notes')
      .update({
        summary,
        updated_at: new Date().toISOString(),
      })
      .eq('id', noteId)
      .select()
      .single();

    if (updateError) {
      console.error('[notes/[id]/route] Error updating note with summary:', updateError);
      return NextResponse.json(
        { error: 'Failed to update note with summary', details: updateError.message },
        { status: 500 }
      );
    }

    // Convert to app format and return
    const appNote = convertToAppFormat(updatedNote, 'note') as AppNote;
    return NextResponse.json(appNote);
  } catch (error) {
    console.error('[notes/[id]/route] Unexpected error:', error);
    return NextResponse.json(
      {
        error: 'Server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * PUT handler for updating a note
 */
export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params;
    const noteId = params.id;

    if (!noteId) {
      return NextResponse.json({ error: 'Note ID not found in URL' }, { status: 400 });
    }

    // Parse request body
    const body = await request.json();
    const { content, summary, checklistContent } = body;

    // Check if Supabase is available
    const isSupabaseAvailable = await checkSupabaseConnection();
    if (!isSupabaseAvailable) {
      return NextResponse.json(
        {
          error: 'Database connection unavailable',
          details: 'Please check your database connection settings.',
        },
        { status: 503 }
      );
    }

    // Use standardized client initialization
    const supabase = createClient();
    if (!supabase) {
      return NextResponse.json(
        { error: 'Failed to initialize database client' },
        { status: 500 }
      );
    }

    // Build update object with only provided fields
    const updateData: any = {
      updated_at: new Date().toISOString(),
    };

    if (content !== undefined) {
      updateData.content = content;
    }

    if (summary !== undefined) {
      updateData.summary = summary;
    }

    if (checklistContent !== undefined) {
      updateData.checklist_content = checklistContent;
    }

    // Update the note
    const { data: updatedNote, error } = await supabase
      .from('notes')
      .update(updateData)
      .eq('id', noteId)
      .select()
      .single();

    if (error) {
      console.error('[notes/[id]/route] Error updating note:', error);
      return NextResponse.json(
        { error: 'Failed to update note', details: error.message },
        { status: 500 }
      );
    }

    if (!updatedNote) {
      return NextResponse.json(
        { error: 'Note not found', details: `No note exists with ID: ${noteId}` },
        { status: 404 }
      );
    }

    // Convert to app format
    const appNote = convertToAppFormat(updatedNote, 'note') as AppNote;

    return NextResponse.json(appNote);
  } catch (error) {
    console.error('[notes/[id]/route] Error in PUT:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * POST handler for generating and saving a summary for a note
 */
export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    // Get the note ID from route parameters
    const params = await context.params;
    const noteId = params.id;

    if (!noteId) {
      return NextResponse.json({ error: 'Note ID not found in URL' }, { status: 400 });
    }

    // Check if Supabase is available
    const isSupabaseAvailable = await checkSupabaseConnection();
    if (!isSupabaseAvailable) {
      return NextResponse.json(
        {
          error: 'Database connection unavailable',
          details: 'Please check your database connection settings.',
        },
        { status: 503 }
      );
    }

    // Use standardized client initialization
    const supabase = createClient();
    if (!supabase) {
      return NextResponse.json(
        { error: 'Failed to initialize database client' },
        { status: 500 }
      );
    }

    // Get the note from Supabase - first check if it exists
    console.log(`[notes/[id]/route] Fetching note with ID: ${noteId}`);
    const { data: notes, error } = await supabase
      .from('notes')
      .select('*')
      .eq('id', noteId);

    if (error) {
      console.error('[notes/[id]/route] Error fetching note:', error);
      return NextResponse.json(
        { error: 'Failed to fetch note', details: error.message },
        { status: 500 }
      );
    }

    if (!notes || notes.length === 0) {
      console.error(`[notes/[id]/route] Note with ID ${noteId} not found`);
      return NextResponse.json(
        { error: 'Note not found', details: `No note exists with ID: ${noteId}` },
        { status: 404 }
      );
    }

    if (notes.length > 1) {
      console.error(`[notes/[id]/route] Multiple notes found with ID ${noteId}`);
      return NextResponse.json(
        { error: 'Data integrity error', details: `Multiple notes found with ID: ${noteId}` },
        { status: 500 }
      );
    }

    const note = notes[0];

    // Check if a summary already exists
    if (note.summary && note.summary.trim() !== '') {
      console.log(`[notes/[id]/route] Found existing summary for note ${noteId}`);
      // Convert to app format and return existing summary
      const appNote = convertToAppFormat(note, 'note') as AppNote;
      return NextResponse.json(appNote);
    }

    console.log(`[notes/[id]/route] No existing summary found for note ${noteId}. Generating new summary.`);

    // Extract the actual content from the note
    const noteContent = extractContent(note.content);
    
    if (!noteContent || noteContent.trim() === '') {
      console.error(`[notes/[id]/route] No content found for note ${noteId}`);
      return NextResponse.json(
        { error: 'No content available to generate summary' },
        { status: 400 }
      );
    }

    // Generate summary using OpenAI
    const prompt = `Create a very concise summary (30-40 words max) of this medical note. PRIORITIZE any medication changes, then other key clinical information. DO NOT include patient names or identifiers:

${noteContent}`;
    
    let summary = '';
    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 200,
      });

      summary = response.choices[0]?.message?.content?.trim() || '';
      
      if (!summary) {
        console.error(`[notes/[id]/route] OpenAI returned empty summary for note ${noteId}`);
      }
    } catch (openaiError) {
      console.error(`[notes/[id]/route] OpenAI API error for note ${noteId}:`, openaiError);
      return NextResponse.json(
        { 
          error: 'Failed to generate summary', 
          details: openaiError instanceof Error ? openaiError.message : 'OpenAI API error'
        },
        { status: 500 }
      );
    }

    // Update the note with the summary
    const { data: updatedNote, error: updateError } = await supabase
      .from('notes')
      .update({
        summary,
        updated_at: new Date().toISOString(),
      })
      .eq('id', noteId)
      .select()
      .single();

    if (updateError) {
      console.error('[notes/[id]/route] Error updating note with summary:', updateError);
      return NextResponse.json(
        { error: 'Failed to update note with summary', details: updateError.message },
        { status: 500 }
      );
    }

    // Convert to app format and return
    const appNote = convertToAppFormat(updatedNote, 'note') as AppNote;
    return NextResponse.json(appNote);
  } catch (error) {
    console.error('[notes/[id]/route] Unexpected error:', error);
    return NextResponse.json(
      {
        error: 'Server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE handler for deleting a note by ID
 */
export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    // Get the note ID from route parameters
    const params = await context.params;
    const noteId = params.id;

    if (!noteId) {
      return NextResponse.json({ error: 'Note ID not found in URL' }, { status: 400 });
    }

    // Check if Supabase is available
    const isSupabaseAvailable = await checkSupabaseConnection();
    if (!isSupabaseAvailable) {
      return NextResponse.json(
        {
          error: 'Database connection unavailable',
          details: 'Please check your database connection settings.',
        },
        { status: 503 }
      );
    }

    // Use standardized client initialization
    const supabase = createClient();
    if (!supabase) {
      return NextResponse.json(
        { error: 'Failed to initialize database client' },
        { status: 500 }
      );
    }

    // Delete the note from Supabase
    const { error } = await supabase
      .from('notes')
      .delete()
      .eq('id', noteId);

    if (error) {
      console.error('[notes/[id]/route] Error deleting note:', error);
      return NextResponse.json(
        { error: 'Failed to delete note', details: error.message },
        { status: 500 }
      );
    }

    // Return success response
    return NextResponse.json({ success: true, message: 'Note deleted successfully' });
  } catch (error) {
    console.error('[notes/[id]/route] Unexpected error:', error);
    return NextResponse.json(
      {
        error: 'Server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}