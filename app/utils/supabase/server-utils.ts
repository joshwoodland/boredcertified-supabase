'use server';

/**
 * @deprecated This module is deprecated in favor of the standardized supabase client.
 * Please import from '@/app/lib/supabase' instead.
 * Example: import { createServerClient, createAdminClient } from '@/app/lib/supabase'
 */

import { createServerClient, createAdminClient } from '@/app/lib/supabase';
import type { AppPatient, AppNote, AppSettings } from '@/app/lib/supabase';
import { convertToAppFormat } from '@/app/lib/supabase';

/**
 * Checks if the Supabase connection is available (server-side only)
 * @returns True if connection is successful, false otherwise
 * @deprecated Use the standardized supabase client from '@/app/lib/supabase'
 */
export async function checkServerSupabaseConnection(): Promise<boolean> {
  try {
    const supabaseServerOrNull = createServerClient();
    if (!supabaseServerOrNull) {
      console.error('[server-utils] Failed to initialize Supabase server client');
      return false;
    }
    const supabase = supabaseServerOrNull;
    const { data, error } = await supabase.from('patients').select('id').limit(1);

    if (error && error.code !== '42P01') { // 42P01 means table doesn't exist, which is fine
      console.error('[server-utils] Supabase connection error (server):', error);
      return false;
    }
    return true;
  } catch (error) {
    console.error('[server-utils] Failed to connect to Supabase (server):', error);
    return false;
  }
}

/**
 * Fetches patients from Supabase (server-side only)
 * @param filterByUserEmail Email to filter patients by
 * @returns Array of patients
 * @deprecated Use the standardized supabase client from '@/app/lib/supabase'
 */
export async function getServerPatients(filterByUserEmail?: string) {
  try {
    const supabaseServerOrNull = createServerClient();
    if (!supabaseServerOrNull) {
      console.error('[server-utils/getServerPatients] Failed to initialize Supabase server client');
      return [];
    }
    const supabase = supabaseServerOrNull;

    // Build query
    let query = supabase
      .from('patients')
      .select('*')
      .eq('is_deleted', false)
      .order('created_at', { ascending: false });

    // Filter by provider email if requested
    if (filterByUserEmail) {
      query = query.eq('provider_email', filterByUserEmail);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[server-utils] Error fetching patients from Supabase:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('[server-utils] Error in getServerPatients:', error);
    return [];
  }
}

/**
 * Fetches notes for a specific patient from Supabase (server-side only)
 * @param patientId The patient's ID
 * @returns Array of notes
 * @deprecated Use the standardized supabase client from '@/app/lib/supabase'
 */
export async function getServerNotes(patientId: string) {
  try {
    const supabaseServerOrNull = createServerClient();
    if (!supabaseServerOrNull) {
      console.error('[server-utils/getServerNotes] Failed to initialize Supabase server client');
      return [];
    }
    const supabase = supabaseServerOrNull;

    const { data, error } = await supabase
      .from('notes')
      .select('*')
      .eq('patient_id', patientId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error(`[server-utils] Error fetching notes for patient ${patientId} from Supabase:`, error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('[server-utils] Error in getServerNotes:', error);
    return [];
  }
}
