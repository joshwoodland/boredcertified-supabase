import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/app/lib/supabase';

/**
 * GET handler for checking the status of note summaries
 */
export async function GET(_request: NextRequest) {
  try {
    const supabase = createServerClient();
    if (!supabase) {
      return NextResponse.json(
        { error: 'Failed to initialize database client' },
        { status: 500 }
      );
    }

    // Get total count of notes
    const { count: totalCount, error: countError } = await supabase
      .from('notes')
      .select('*', { count: 'exact', head: true });

    if (countError) {
      console.error('Error counting notes:', countError);
      return NextResponse.json(
        { error: 'Failed to count notes', details: countError.message },
        { status: 500 }
      );
    }

    // Get count of notes with summaries
    const { count: withSummaryCount, error: summaryCountError } = await supabase
      .from('notes')
      .select('*', { count: 'exact', head: true })
      .not('summary', 'is', null)
      .neq('summary', '');

    if (summaryCountError) {
      console.error('Error counting notes with summaries:', summaryCountError);
      return NextResponse.json(
        { error: 'Failed to count notes with summaries', details: summaryCountError.message },
        { status: 500 }
      );
    }

    // Get a sample of notes without summaries
    const { data: notesWithoutSummaries, error: sampleError } = await supabase
      .from('notes')
      .select('id, created_at, patient_id')
      .or('summary.is.null,summary.eq.""')
      .order('created_at', { ascending: false })
      .limit(10);

    if (sampleError) {
      console.error('Error fetching sample notes:', sampleError);
    }

    // Check OpenAI API key status
    const openaiKeyPresent = !!process.env.OPENAI_API_KEY;

    return NextResponse.json({
      status: 'ok',
      summary: {
        totalNotes: totalCount || 0,
        notesWithSummaries: withSummaryCount || 0,
        notesWithoutSummaries: (totalCount || 0) - (withSummaryCount || 0),
        percentageComplete: totalCount ? Math.round(((withSummaryCount || 0) / totalCount) * 100) : 0,
      },
      configuration: {
        openaiKeyPresent,
        supabaseConnected: true,
      },
      sampleNotesWithoutSummaries: notesWithoutSummaries || [],
      message: 'Run `npm run supabase:generate-summaries` to generate missing summaries',
    });
  } catch (error) {
    console.error('Error checking summary status:', error);
    return NextResponse.json(
      {
        error: 'Server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
} 