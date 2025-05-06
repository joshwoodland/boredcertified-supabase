import { NextRequest, NextResponse } from 'next/server';
import { checkSupabaseConnection, supabase, convertToAppFormat } from '@/app/lib/supabase';
import OpenAI from 'openai';
import { formatSoapNote } from '@/app/utils/formatSoapNote';
import { safeJsonParse } from '@/app/utils/safeJsonParse';
import { createClient } from '@/app/utils/supabase/server';
import { cookies } from 'next/headers';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const noteId = params.id;
    let note = null;
    
    // Check if Supabase is available
    const isSupabaseAvailable = await checkSupabaseConnection();
    
    if (!isSupabaseAvailable) {
      return NextResponse.json({
        error: 'Database connection unavailable',
        details: 'Please check your database connection settings.'
      }, { status: 503 });
    }

    console.log('Using Supabase to get note for editing');
    // Get note from Supabase
    const { data, error } = await supabase
      .from('notes')
      .select('*')
      .eq('id', noteId)
      .single();
      
    if (error) {
      console.error('Error fetching note from Supabase:', error);
      return NextResponse.json({ 
        error: 'Failed to fetch note', 
        details: error.message 
      }, { status: 500 });
    }
    
    if (!data) {
      return NextResponse.json({ error: 'Note not found' }, { status: 404 });
    }

    note = convertToAppFormat(data, 'note');
    return NextResponse.json(note);
  } catch (error) {
    console.error('Error fetching note:', error);
    return NextResponse.json({
      error: 'Failed to fetch note',
      details: error instanceof Error ? error.message : 'Unknown error occurred'
    }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { editRequest } = await request.json();
    const noteId = params.id;
    
    // Validate required data
    if (!noteId || !editRequest) {
      return NextResponse.json({ 
        error: 'Missing required fields', 
        details: 'Both note ID and edit request are required' 
      }, { status: 400 });
    }
    
    // Check if Supabase is available
    const isSupabaseAvailable = await checkSupabaseConnection();
    
    if (!isSupabaseAvailable) {
      return NextResponse.json({
        error: 'Database connection unavailable',
        details: 'Please check your database connection settings.'
      }, { status: 503 });
    }

    // Get the original note
    console.log('Using Supabase to get note for AI Magic edit');
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

    const note = convertToAppFormat(noteData, 'note');
    if (!note) {
      return NextResponse.json({ 
        error: 'Failed to convert note data', 
        details: 'Error converting note format' 
      }, { status: 500 });
    }
    
    // Extract the original content from note
    let originalContent = '';
    try {
      const parsedContent = JSON.parse(note.content || '');
      originalContent = typeof parsedContent.content === 'string' ? parsedContent.content : String(note.content || '');
    } catch {
      originalContent = String(note.content || '');
    }

    // Prepare messages for OpenAI
    const messages = [
      {
        role: 'system',
        content: 'You are a medical scribe assistant. Your task is to edit the medical note based on the provided edit request.'
      },
      {
        role: 'user',
        content: `Original note:\n${originalContent}\n\nEdit request:\n${editRequest}\n\nPlease provide the complete edited note, incorporating the requested changes while maintaining the original format and structure.`
      }
    ];

    // Call OpenAI API
    const completion = await openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: messages as any,
      temperature: 0.3,
      max_tokens: 4000
    });

    const editedContent = completion.choices[0]?.message?.content;
    
    if (!editedContent || typeof editedContent !== 'string') {
      throw new Error('Empty or invalid response from OpenAI API');
    }
    
    // Format the edited content
    const formattedContent = formatSoapNote(editedContent);
    
    // Create a JSON string with the content
    const jsonContent = JSON.stringify({
      content: editedContent,
      formattedContent
    });
    
    // Update the note in Supabase
    console.log('Updating note in Supabase after AI Magic edit');
    const { data: updatedData, error: updateError } = await supabase
      .from('notes')
      .update({ 
        content: jsonContent,
        updated_at: new Date().toISOString()
      })
      .eq('id', noteId)
      .select()
      .single();
      
    if (updateError) {
      console.error('Error updating note in Supabase:', updateError);
      return NextResponse.json({ 
        error: 'Failed to update note', 
        details: updateError.message 
      }, { status: 500 });
    }

    const updatedNote = convertToAppFormat(updatedData, 'note');
    return NextResponse.json(updatedNote);
  } catch (error) {
    console.error('Error editing note:', error);
    return NextResponse.json({
      error: 'Failed to edit note',
      details: error instanceof Error ? error.message : 'Unknown error occurred'
    }, { status: 500 });
  }
}
