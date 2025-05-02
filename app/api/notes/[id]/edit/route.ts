import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/app/lib/db';
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
    
    // Get the note
    const note = await prisma.note.findUnique({
      where: { id: noteId },
    });
    
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
    const note = await prisma.note.findUnique({
      where: { id: noteId },
    });
    
    if (!note) {
      return NextResponse.json({ error: 'Note not found' }, { status: 404 });
    }
    
    // Extract the original content from note
    let originalContent = '';
    try {
      const parsedContent = safeJsonParse<any>(note.content);
      originalContent = parsedContent && parsedContent.content 
        ? parsedContent.content 
        : note.content;
    } catch (error) {
      // If parsing fails, use the content as is
      originalContent = note.content;
    }
    
    // Call OpenAI API to edit the note
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are a medical assistant helping to edit a SOAP note. Apply the requested changes precisely and distinctly.

IMPORTANT INSTRUCTIONS:
1. Make the requested changes clearly visible and significant
2. Always implement the exact changes requested, even if they seem minor
3. Make the changes stand out - don't be conservative with the edits
4. Maintain medical accuracy and professional formatting
5. Return the complete edited SOAP note
6. Do not be subtle with changes - make them obvious
7. If asked to change a diagnosis, ensure it's properly updated throughout the note

The edited note should clearly show the changes that have been requested.`
        },
        {
          role: 'user',
          content: `Here is the original SOAP note:\n\n${originalContent}\n\nEdit request: ${editRequest}\n\nMake sure the edits are clearly applied and visible in your response.`
        }
      ],
      temperature: 0.2,
    });
    
    const editedContent = completion.choices[0]?.message?.content;
    
    if (!editedContent) {
      throw new Error('Empty response from OpenAI API');
    }
    
    // Format the edited content
    const formattedContent = formatSoapNote(editedContent);
    
    // Update the note in the database
    const updatedNote = await prisma.note.update({
      where: { id: noteId },
      data: {
        content: JSON.stringify({
          content: editedContent,
          formattedContent
        })
      },
    });
    
    return NextResponse.json(updatedNote);
  } catch (error) {
    console.error('Error editing note:', error);
    return NextResponse.json({
      error: 'Failed to edit note',
      details: error instanceof Error ? error.message : 'Unknown error occurred'
    }, { status: 500 });
  }
}
