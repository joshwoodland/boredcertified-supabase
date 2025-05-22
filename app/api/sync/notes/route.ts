import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/app/lib/supabase';
import {
  convertToAppFormat,
  convertToSupabaseFormat,
  type SupabaseNote
} from '@/app/lib/supabaseTypes';

// Define types for sync request and response
interface SyncRequest {
  deviceId: string;
  lastSyncTime?: string;
  notes: any[];
}

interface SyncResponse {
  notes: any[];
  conflicts: any[];
}

// Helper function to check Supabase connection
async function checkSupabaseConnection(): Promise<boolean> {
  try {
    const supabase = createServerClient();
    if (!supabase) {
      console.error('[sync/notes/route] Failed to initialize Supabase client');
      return false;
    }

    const { data, error } = await supabase.from('notes').select('id').limit(1);
    if (error && error.code !== '42P01') { // 42P01 means table doesn't exist, which is fine
      console.error('[sync/notes/route] Supabase connection error:', error);
      return false;
    }
    return true;
  } catch (error) {
    console.error('[sync/notes/route] Failed to connect to Supabase:', error);
    return false;
  }
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
    const supabase = createServerClient();
    if (!supabase) {
      return NextResponse.json({ error: 'Database connection error' }, { status: 503 });
    }
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

    // Convert server notes to App format for consistency
    const formattedServerNotes = (serverNotes as SupabaseNote[])
      .map(note => convertToAppFormat(note, 'note'))
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
