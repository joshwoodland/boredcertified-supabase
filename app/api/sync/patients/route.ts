import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/app/lib/supabase';
import {
  convertToAppFormat,
  convertToSupabaseFormat,
  type SupabasePatient
} from '@/app/lib/supabaseTypes';

// Define types for sync request and response
interface SyncRequest {
  deviceId: string;
  lastSyncTime?: string;
  patients: any[];
}

interface SyncResponse {
  patients: any[];
  conflicts: any[];
}

// Helper function to check Supabase connection
async function checkSupabaseConnection(): Promise<boolean> {
  try {
    const supabase = createServerClient();
    if (!supabase) {
      console.error('[sync/patients/route] Failed to initialize Supabase client');
      return false;
    }

    const { data, error } = await supabase.from('patients').select('id').limit(1);
    if (error && error.code !== '42P01') { // 42P01 means table doesn't exist, which is fine
      console.error('[sync/patients/route] Supabase connection error:', error);
      return false;
    }
    return true;
  } catch (error) {
    console.error('[sync/patients/route] Failed to connect to Supabase:', error);
    return false;
  }
}

export async function GET(request: NextRequest) {
  try {
    // Get the provider's email from the query string
    const { searchParams } = new URL(request.url);
    const providerEmail = searchParams.get('provider_email');

    if (!providerEmail) {
      return NextResponse.json({ error: 'Provider email is required' }, { status: 400 });
    }

    // Get all patients for this provider
    const supabase = createServerClient();
    if (!supabase) {
      return NextResponse.json({ error: 'Database connection error' }, { status: 503 });
    }
    const { data: serverPatients, error: patientsError } = await supabase
      .from('patients')
      .select('*')
      .eq('provider_email', providerEmail);

    if (patientsError) {
      console.error('Error fetching patients:', patientsError);
      return NextResponse.json({ error: 'Failed to fetch patients' }, { status: 500 });
    }

    return NextResponse.json(serverPatients);
  } catch (error) {
    console.error('Error in sync/patients route:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    // Parse request data
    const data: SyncRequest = await request.json();
    const { deviceId, lastSyncTime, patients } = data;

    if (!deviceId) {
      return NextResponse.json({ error: 'Device ID is required' }, { status: 400 });
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

    // Process incoming patients
    const conflicts = [];
    const serverUpdates = [];

    // Get patients from server that were updated since last sync
    let query = supabase.from('patients').select('*');
    if (lastSyncTime) {
      query = query.or(`updated_at.gt.${lastSyncTime},deleted_at.gt.${lastSyncTime}`);
    }
    const { data: serverPatients, error: fetchError } = await query;

    if (fetchError) {
      console.error('[sync/patients/route] Error fetching patients:', fetchError);
      return NextResponse.json(
        { error: 'Failed to fetch patients', details: fetchError.message },
        { status: 500 }
      );
    }

    // Process incoming patients
    for (const patient of patients) {
      const supabasePatient = convertToSupabaseFormat(patient, 'patient') as SupabasePatient;

      // Check if patient exists
      const { data: existingPatient, error: checkError } = await supabase
        .from('patients')
        .select('*')
        .eq('id', supabasePatient.id)
        .single();

      if (checkError && checkError.code !== 'PGRST116') { // PGRST116 means not found
        console.error('[sync/patients/route] Error checking patient:', checkError);
        continue;
      }

      if (!existingPatient) {
        // Insert new patient
        const { error: insertError } = await supabase
          .from('patients')
          .insert(supabasePatient);

        if (insertError) {
          console.error('[sync/patients/route] Error inserting patient:', insertError);
          conflicts.push({ id: supabasePatient.id, error: insertError.message });
        }
      } else {
        // Update existing patient if local version is newer
        const localUpdatedAt = new Date(supabasePatient.updated_at);
        const serverUpdatedAt = new Date(existingPatient.updated_at);

        if (localUpdatedAt > serverUpdatedAt) {
          const { error: updateError } = await supabase
            .from('patients')
            .update(supabasePatient)
            .eq('id', supabasePatient.id);

          if (updateError) {
            console.error('[sync/patients/route] Error updating patient:', updateError);
            conflicts.push({ id: supabasePatient.id, error: updateError.message });
          }
        } else if (localUpdatedAt < serverUpdatedAt) {
          // Server version is newer, add to server updates
          serverUpdates.push(existingPatient);
        }
      }
    }

    // Add any server patients not in the request
    const localPatientIds = patients.map((p: any) => p.id);
    const additionalServerPatients = serverPatients?.filter(
      (p) => !localPatientIds.includes(p.id)
    ) || [];

    const response: SyncResponse = {
      patients: [...serverUpdates, ...additionalServerPatients].map(
        (p) => convertToAppFormat(p, 'patient')
      ),
      conflicts,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('[sync/patients/route] Unexpected error:', error);
    return NextResponse.json(
      {
        error: 'Server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
