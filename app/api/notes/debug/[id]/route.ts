import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/app/utils/supabase/server';

/**
 * Debug endpoint to check if a note exists and its summary status
 */
export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params;
    const noteId = params.id;

    if (!noteId) {
      return NextResponse.json({ error: 'Note ID not found in URL' }, { status: 400 });
    }

    const supabase = createClient();
    if (!supabase) {
      return NextResponse.json(
        { error: 'Failed to initialize database client' },
        { status: 500 }
      );
    }

    // Check if note exists
    const { data: notes, error } = await supabase
      .from('notes')
      .select('id, created_at, patient_id, summary, content')
      .eq('id', noteId);

    if (error) {
      return NextResponse.json({
        noteId,
        exists: false,
        error: error.message,
        details: error
      });
    }

    if (!notes || notes.length === 0) {
      return NextResponse.json({
        noteId,
        exists: false,
        message: 'Note not found in database'
      });
    }

    if (notes.length > 1) {
      return NextResponse.json({
        noteId,
        exists: true,
        error: 'Multiple notes found with same ID',
        count: notes.length
      });
    }

    const note = notes[0];
    const hasSummary = !!(note.summary && note.summary.trim() !== '');
    const hasContent = !!(note.content && note.content.trim() !== '');

    return NextResponse.json({
      noteId,
      exists: true,
      hasSummary,
      hasContent,
      summaryLength: note.summary ? note.summary.length : 0,
      contentLength: note.content ? note.content.length : 0,
      createdAt: note.created_at,
      patientId: note.patient_id,
      summary: note.summary || null,
      contentPreview: note.content ? note.content.substring(0, 100) + '...' : null
    });
  } catch (error) {
    return NextResponse.json({
      noteId: 'unknown',
      exists: false,
      error: 'Server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
} 