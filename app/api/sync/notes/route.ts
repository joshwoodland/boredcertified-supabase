import { NextRequest, NextResponse } from 'next/server';
import { checkSupabaseConnection, supabase, convertToPrismaFormat, convertToSupabaseFormat, SupabaseNote } from '@/app/lib/supabase';

interface SyncRequest {
  deviceId: string;
  lastSyncTime?: string;
  notes?: Array<{
    id: string;
    remote_id?: string;
    patient_id: string;
    content: string;
    transcript: string;
    summary?: string;
    is_initial_visit: number;
    created_at: string;
    updated_at: string;
  }>;
}

export async function POST(request: NextRequest) {
  try {
    // Parse request data
    const data: SyncRequest = await request.json();
    const { deviceId, lastSyncTime, notes } = data;

    if (!deviceId) {
      return NextResponse.json({ error: 'Device ID is required' }, { status: 400 });
    }

    // Check if Supabase is available
    const isSupabaseAvailable = await checkSupabaseConnection();
    
    if (!isSupabaseAvailable) {
      return NextResponse.json({
        error: 'Database connection unavailable',
        details: 'Please check your database connection settings.'
      }, { status: 503 });
    }

    // Get notes modified since last sync
    let modifiedSince = new Date(0); // Default to epoch
    if (lastSyncTime) {
      modifiedSince = new Date(lastSyncTime);
    }

    // Get notes from server that were modified since last sync
    const { data: serverNotes, error: fetchError } = await supabase
      .from('notes')
      .select('*')
      .gt('updated_at', modifiedSince.toISOString());

    if (fetchError) {
      console.error('Error fetching notes from Supabase:', fetchError);
      return NextResponse.json({ 
        error: 'Failed to fetch notes', 
        details: fetchError.message 
      }, { status: 500 });
    }

    // Process notes from client
    const conflicts: Array<{ local: any; remote: SupabaseNote }> = [];
    if (notes && notes.length > 0) {
      for (const note of notes) {
        // Check if note exists
        const { data: existingNote, error: noteError } = await supabase
          .from('notes')
          .select('*')
          .eq('id', note.remote_id || note.id)
          .single();

        if (noteError && noteError.code !== 'PGRST116') { // PGRST116 is "not found"
          console.error('Error checking for existing note:', noteError);
          continue;
        }

        if (existingNote) {
          // Check for conflicts (both client and server modified)
          const clientModified = new Date(note.updated_at);
          const serverModified = new Date(existingNote.updated_at);

          if (clientModified > modifiedSince && serverModified > modifiedSince) {
            // Conflict detected - for now, server wins
            conflicts.push({
              local: note,
              remote: existingNote
            });
          } else if (clientModified > serverModified) {
            // Client has newer version, update server
            const { error: updateError } = await supabase
              .from('notes')
              .update({
                content: note.content,
                transcript: note.transcript,
                summary: note.summary,
                is_initial_visit: note.is_initial_visit === 1,
                updated_at: new Date().toISOString()
              })
              .eq('id', existingNote.id);

            if (updateError) {
              console.error('Error updating note in Supabase:', updateError);
              continue;
            }
          }
        } else {
          // New note from client, create on server
          const { error: createError } = await supabase
            .from('notes')
            .insert({
              id: note.remote_id || note.id,
              patient_id: note.patient_id,
              content: note.content,
              transcript: note.transcript,
              summary: note.summary,
              is_initial_visit: note.is_initial_visit === 1,
              created_at: new Date(note.created_at).toISOString(),
              updated_at: new Date().toISOString()
            });

          if (createError) {
            console.error('Error creating note in Supabase:', createError);
            continue;
          }
        }
      }
    }

    // Convert server notes to Prisma format for consistency
    const formattedServerNotes = (serverNotes as SupabaseNote[])
      .map(note => convertToPrismaFormat(note, 'note'))
      .filter(note => note !== null);

    return NextResponse.json({
      notes: formattedServerNotes,
      conflicts,
      lastSyncTime: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error during sync:', error);
    return NextResponse.json({
      error: 'Sync failed',
      details: error instanceof Error ? error.message : 'Unknown error occurred'
    }, { status: 500 });
  }
}
