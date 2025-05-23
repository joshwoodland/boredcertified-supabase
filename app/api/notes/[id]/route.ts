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
import { createServerClient } from '@/app/lib/supabase';
import { convertToAppFormat, type AppNote } from '@/app/lib/supabaseTypes';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Helper function to check Supabase connection
async function checkSupabaseConnection(): Promise<boolean> {
  try {
    const supabase = createServerClient();
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
    const supabase = createServerClient();
    if (!supabase) {
      return NextResponse.json(
        { error: 'Failed to initialize database client' },
        { status: 500 }
      );
    }

    // Get the note from Supabase
    const { data: note, error } = await supabase
      .from('notes')
      .select('*')
      .eq('id', noteId)
      .single();

    if (error) {
      console.error('[notes/[id]/route] Error fetching note:', error);
      return NextResponse.json(
        { error: 'Failed to fetch note', details: error.message },
        { status: 500 }
      );
    }

    // Check if a summary already exists
    if (note.summary && note.summary.trim() !== '') {
      console.log(`[notes/[id]/route] Found existing summary for note ${noteId}`);
      // Convert to app format and return existing summary
      const appNote = convertToAppFormat(note, 'note') as AppNote;
      return NextResponse.json(appNote);
    }

    console.log(`[notes/[id]/route] No existing summary found for note ${noteId}. Generating new summary.`);

    // Generate summary using OpenAI
    const prompt = `Create a very concise summary (30-40 words max) of this medical note. PRIORITIZE any medication changes, then other key clinical information. DO NOT include patient names or identifiers:

${note.content}`;
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens: 200,
    });

    const summary = response.choices[0]?.message?.content?.trim() || '';

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
 * PUT handler for updating a note (content and/or summary)
 */
export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    // Get the note ID from route parameters
    const { id: noteId } = await context.params;
    if (!noteId) {
      return NextResponse.json(
        { error: 'Note ID missing from URL.' },
        { status: 400 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const { content, summary, aiMagicRequest } = body as {
      content?: unknown;
      summary?: unknown;
      aiMagicRequest?: string;
    };

    // Check if Supabase is available
    const isSupabaseAvailable = await checkSupabaseConnection();
    if (!isSupabaseAvailable) {
      return NextResponse.json(
        {
          error: 'Database unavailable',
          details: 'Failed health-check against Supabase.',
        },
        { status: 503 }
      );
    }

    // Use standardized client initialization
    const supabase = createServerClient();
    if (!supabase) {
      return NextResponse.json(
        { error: 'Failed to initialize database client' },
        { status: 500 }
      );
    }

    // Prepare update data
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    // If this is an AI Magic request, process it with OpenAI
    if (aiMagicRequest && typeof content === 'string') {
      try {
        console.log('[notes/[id]/route] Processing AI Magic request');

        // Create a prompt for OpenAI that includes both the edit request and original content
        const prompt = `Please use these edit requests and apply them to the entire SOAP note.
Return the full SOAP note in edited form without any extra words or comments.

Edit Request: ${aiMagicRequest}

Original SOAP Note:
${content}`;

        // Call OpenAI API to process the edit
        const response = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.3,
          max_tokens: 2000,
        });

        // Get the edited content from OpenAI
        const editedContent = response.choices[0]?.message?.content?.trim() || '';

        // Format the content before saving
        const formattedContent = editedContent; // We'll use the raw content as is

        // Create the content object with both raw and formatted content
        const contentToSave = JSON.stringify({
          content: editedContent,
          formattedContent
        });

        // Use the edited content as the new content
        updateData.content = contentToSave;

        console.log('[notes/[id]/route] AI Magic processing complete');
      } catch (error) {
        console.error('[notes/[id]/route] Error processing AI Magic request:', error);
        return NextResponse.json(
          {
            error: 'Failed to process AI Magic request',
            message: error instanceof Error ? error.message : 'Unknown error'
          },
          { status: 500 }
        );
      }
    } else if (content !== undefined) {
      updateData.content = content;
    }

    if (summary !== undefined) {
      updateData.summary = summary;
    }

    // Update the note in Supabase
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
    const supabase = createServerClient();
    if (!supabase) {
      return NextResponse.json(
        { error: 'Failed to initialize database client' },
        { status: 500 }
      );
    }

    // Get the note from Supabase
    const { data: note, error } = await supabase
      .from('notes')
      .select('*')
      .eq('id', noteId)
      .single();

    if (error) {
      console.error('[notes/[id]/route] Error fetching note:', error);
      return NextResponse.json(
        { error: 'Failed to fetch note', details: error.message },
        { status: 500 }
      );
    }

    // Check if a summary already exists
    if (note.summary && note.summary.trim() !== '') {
      console.log(`[notes/[id]/route] Found existing summary for note ${noteId}`);
      // Convert to app format and return existing summary
      const appNote = convertToAppFormat(note, 'note') as AppNote;
      return NextResponse.json(appNote);
    }

    console.log(`[notes/[id]/route] No existing summary found for note ${noteId}. Generating new summary.`);

    // Generate summary using OpenAI
    const prompt = `Create a very concise summary (30-40 words max) of this medical note. PRIORITIZE any medication changes, then other key clinical information. DO NOT include patient names or identifiers:

${note.content}`;
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens: 200,
    });

    const summary = response.choices[0]?.message?.content?.trim() || '';

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
    const supabase = createServerClient();
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