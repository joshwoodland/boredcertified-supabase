import { NextRequest, NextResponse } from 'next/server';
import { prisma, connectWithFallback } from '@/app/lib/db';
import { checkSupabaseConnection, supabase, convertToPrismaFormat } from '@/app/lib/supabase';
import OpenAI from 'openai';
import { formatSoapNote } from '@/app/utils/formatSoapNote';
import { safeJsonParse } from '@/app/utils/safeJsonParse';

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
    
    // First check if Supabase is available
    const isSupabaseAvailable = await checkSupabaseConnection();
    
    if (isSupabaseAvailable) {
      console.log('Using Supabase to get note for editing');
      // Try to get note from Supabase
      const { data, error } = await supabase
        .from('notes')
        .select('*')
        .eq('id', noteId)
        .single();
        
      if (error) {
        console.error('Error fetching note from Supabase:', error);
        // Will fall back to Prisma
      } else if (data) {
        note = convertToPrismaFormat(data, 'note');
      }
    }
    
    // Fall back to Prisma if Supabase is unavailable or note not found
    if (!note) {
      console.log('Falling back to Prisma to get note for editing');
      const db = await connectWithFallback();
      note = await db.note.findUnique({
        where: { id: noteId },
      });
    }
    
    if (!note) {
      return NextResponse.json({ error: 'Note not found' }, { status: 404 });
    }
    
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
    
    // Get the original note
    let note = null;
    
    // First check if Supabase is available
    const isSupabaseAvailable = await checkSupabaseConnection();
    
    if (isSupabaseAvailable) {
      console.log('Using Supabase to get note for AI Magic edit');
      // Try to get note from Supabase
      const { data, error } = await supabase
        .from('notes')
        .select('*')
        .eq('id', noteId)
        .single();
        
      if (error) {
        console.error('Error fetching note from Supabase:', error);
        // Will fall back to Prisma
      } else if (data) {
        note = convertToPrismaFormat(data, 'note');
      }
    }
    
    // Fall back to Prisma if Supabase is unavailable or note not found
    if (!note) {
      console.log('Falling back to Prisma to get note for AI Magic edit');
      const db = await connectWithFallback();
      note = await db.note.findUnique({
        where: { id: noteId },
      });
    }
    
    if (!note) {
      return NextResponse.json({ error: 'Note not found' }, { status: 404 });
    }
    
    // Extract the original content from note
    let originalContent = '';
    try {
      // Use a more specific type instead of any
      const parsedContent = safeJsonParse<{ content?: string; formattedContent?: string }>(note.content);
      // Use optional chaining for safer property access
      originalContent = parsedContent?.content 
        ? parsedContent.content 
        : note.content;
    } catch (error) {
      // If parsing fails, use the content as is
      originalContent = note.content;
    }
    
    // Ensure originalContent is a string
    if (typeof originalContent !== 'string') {
      originalContent = String(originalContent);
    }
    
    // Define system prompt as a constant string
    const systemPrompt = `You are a medical assistant helping to edit a SOAP note. Apply the requested changes precisely and distinctly.

IMPORTANT INSTRUCTIONS:
1. Make the requested changes clearly visible and significant
2. Always implement the exact changes requested, even if they seem minor
3. Make the changes stand out - don't be conservative with the edits
4. Maintain medical accuracy and professional formatting
5. Return the complete edited SOAP note
6. Do not be subtle with changes - make them obvious
7. If asked to change a diagnosis, ensure it's properly updated throughout the note

The edited note should clearly show the changes that have been requested.`;

    // Define user prompt with the note content and edit request
    const userPrompt = `Here is the original SOAP note:\n\n${originalContent}\n\nEdit request: ${editRequest}\n\nMake sure the edits are clearly applied and visible in your response.`;

    // Call OpenAI API to edit the note
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: systemPrompt
        },
        {
          role: 'user',
          content: userPrompt
        }
      ],
      temperature: 0.2,
    });
    
    // Handle potential undefined values with proper type checking
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
    
    let updatedNote = null;
    let updateSuccess = false;
    
    // Update the note in Supabase if available
    if (isSupabaseAvailable) {
      console.log('Updating note in Supabase after AI Magic edit');
      const { data, error } = await supabase
        .from('notes')
        .update({ 
          content: jsonContent,
          updated_at: new Date().toISOString()
        })
        .eq('id', noteId)
        .select()
        .single();
        
      if (error) {
        console.error('Error updating note in Supabase:', error);
        // Will fall back to Prisma
      } else if (data) {
        updatedNote = convertToPrismaFormat(data, 'note');
        updateSuccess = true;
      }
    }
    
    // Fall back to Prisma if Supabase update failed or is unavailable
    if (!updateSuccess) {
      console.log('Falling back to Prisma to update note after AI Magic edit');
      const db = await connectWithFallback();
      updatedNote = await db.note.update({
        where: { id: noteId },
        data: {
          content: jsonContent
        },
      });
    }
    
    if (!updatedNote) {
      throw new Error('Failed to update note in both Supabase and SQLite');
    }
    
    return NextResponse.json(updatedNote);
  } catch (error) {
    console.error('Error editing note:', error);
    return NextResponse.json({
      error: 'Failed to edit note',
      details: error instanceof Error ? error.message : 'Unknown error occurred'
    }, { status: 500 });
  }
}
