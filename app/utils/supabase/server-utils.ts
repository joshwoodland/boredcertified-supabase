'use server';

import { createClient } from '@/app/utils/supabase/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import type { AppPatient, AppNote, AppSettings } from '@/app/lib/supabase';

// Get environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

/**
 * Creates a Supabase admin client using the service role key.
 * This bypasses RLS policies and should only be used in trusted server contexts.
 */
export async function createAdminClient() {
  return createSupabaseClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      persistSession: false,
    }
  });
}

/**
 * Checks if the Supabase connection is available (server-side only)
 * @returns True if connection is successful, false otherwise
 */
export async function checkServerSupabaseConnection(): Promise<boolean> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.from('patients').select('id').limit(1);
    
    if (error && error.code !== '42P01') { // 42P01 means table doesn't exist, which is fine
      console.error('Supabase connection error (server):', error);
      return false;
    }
    return true;
  } catch (error) {
    console.error('Failed to connect to Supabase (server):', error);
    return false;
  }
}

/**
 * Converts Supabase record format to App format (server-side version)
 */
export async function convertServerRecordToApp(record: any, type: 'patient' | 'note' | 'settings'): Promise<AppPatient | AppNote | AppSettings | null> {
  if (!record) return null;
  
  switch (type) {
    case 'patient': {
      return {
        id: record.id,
        createdAt: new Date(record.created_at),
        updatedAt: new Date(record.updated_at),
        name: record.name,
        isDeleted: record.is_deleted,
        deletedAt: record.deleted_at ? new Date(record.deleted_at) : null,
        providerEmail: record.provider_email,
      } as AppPatient;
    }
    case 'note': {
      return {
        id: record.id,
        createdAt: new Date(record.created_at),
        updatedAt: new Date(record.updated_at),
        patientId: record.patient_id,
        transcript: record.transcript,
        content: record.content,
        summary: record.summary,
        isInitialVisit: record.is_initial_visit,
      } as AppNote;
    }
    case 'settings': {
      return {
        id: record.id,
        darkMode: record.dark_mode,
        gptModel: record.gpt_model,
        initialVisitPrompt: record.initial_visit_prompt,
        followUpVisitPrompt: record.follow_up_visit_prompt,
        autoSave: record.auto_save,
        lowEchoCancellation: record.low_echo_cancellation,
        email: record.email,
        userId: record.user_id,
        updatedAt: new Date(record.updated_at),
      } as AppSettings;
    }
    default:
      return null;
  }
}

/**
 * Fetches patients from Supabase (server-side only)
 * @param filterByUserEmail Email to filter patients by
 * @returns Array of patients
 */
export async function getServerPatients(filterByUserEmail?: string) {
  try {
    const supabase = await createClient();
    
    // Build query
    let query = supabase
      .from('patients')
      .select('*')
      .order('created_at', { ascending: false });
    
    // Filter by provider email if requested
    if (filterByUserEmail) {
      query = query.eq('provider_email', filterByUserEmail);
    }
    
    const { data, error } = await query;
    
    if (error) {
      console.error('Error fetching patients from Supabase:', error);
      return [];
    }
    
    return data || [];
  } catch (error) {
    console.error('Error in getServerPatients:', error);
    return [];
  }
}

/**
 * Fetches notes for a specific patient from Supabase (server-side only)
 * @param patientId The patient's ID
 * @returns Array of notes
 */
export async function getServerNotes(patientId: string) {
  try {
    const supabase = await createClient();
    
    const { data, error } = await supabase
      .from('notes')
      .select('*')
      .eq('patient_id', patientId)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error(`Error fetching notes for patient ${patientId} from Supabase:`, error);
      return [];
    }
    
    return data || [];
  } catch (error) {
    console.error('Error in getServerNotes:', error);
    return [];
  }
} 