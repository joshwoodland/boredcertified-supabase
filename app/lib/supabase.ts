import { createClient } from '@supabase/supabase-js';

// Check if we're running in the browser or on the server
const isClient = typeof window !== 'undefined';

// Initialize Supabase client with appropriate environment variables
// For client-side, use the NEXT_PUBLIC_ prefixed env vars
// For server-side, use the regular env vars
const supabaseUrl = isClient
  ? process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  : process.env.SUPABASE_URL || '';

const supabaseKey = isClient
  ? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '' // Use anon key for client-side
  : process.env.SUPABASE_SERVICE_ROLE_KEY || ''; // Use service role key for server-side

// Create Supabase client instance
export const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Checks if the Supabase connection is available
 * @returns True if connection is successful, false otherwise
 */
export async function checkSupabaseConnection(): Promise<boolean> {
  try {
    const { data, error } = await supabase.from('patients').select('id').limit(1);
    if (error && error.code !== '42P01') { // 42P01 means table doesn't exist, which is fine
      console.error('Supabase connection error:', error);
      return false;
    }
    return true;
  } catch (error) {
    console.error('Failed to connect to Supabase:', error);
    return false;
  }
}

/**
 * Fetches all patients from Supabase
 * @returns Array of patients
 */
export async function getSupabasePatients() {
  const { data, error } = await supabase
    .from('patients')
    .select('*')
    .order('created_at', { ascending: false });
  
  if (error) {
    console.error('Error fetching patients from Supabase:', error);
    return [];
  }
  
  return data || [];
}

/**
 * Fetches notes for a specific patient from Supabase
 * @param patientId The patient's ID
 * @returns Array of notes
 */
export async function getSupabaseNotes(patientId: string) {
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
}

/**
 * Fetches app settings from Supabase
 * @returns App settings object or null if not found
 */
export async function getSupabaseAppSettings() {
  const { data, error } = await supabase
    .from('app_settings')
    .select('*')
    .eq('id', 'default')
    .single();
  
  if (error) {
    console.error('Error fetching app settings from Supabase:', error);
    return null;
  }
  
  return data;
}

/**
 * Converts Supabase record format to Prisma format
 * @param record The Supabase record to convert
 * @returns Converted record in Prisma format
 */
interface SupabasePatient {
  id: string;
  created_at: string;
  updated_at: string;
  name: string;
  is_deleted: boolean;
  deleted_at: string | null;
}

interface SupabaseNote {
  id: string;
  created_at: string;
  updated_at: string;
  patient_id: string;
  transcript: string;
  content: string;
  summary: string | null;
  audio_file_url: string | null;
  is_initial_visit: boolean;
}

interface SupabaseAppSettings {
  id: string;
  dark_mode: boolean;
  gpt_model: string;
  initial_visit_prompt: string;
  follow_up_visit_prompt: string;
  auto_save: boolean;
  low_echo_cancellation: boolean;
  updated_at: string;
}

type SupabaseRecord = SupabasePatient | SupabaseNote | SupabaseAppSettings;

interface PrismaPatient {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  name: string;
  isDeleted: boolean;
  deletedAt: Date | null;
}

interface PrismaNote {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  patientId: string;
  transcript: string;
  content: string;
  summary: string | null;
  audioFileUrl: string | null;
  isInitialVisit: boolean;
}

interface PrismaAppSettings {
  id: string;
  darkMode: boolean;
  gptModel: string;
  initialVisitPrompt: string;
  followUpVisitPrompt: string;
  autoSave: boolean;
  lowEchoCancellation: boolean;
  updatedAt: Date;
}

type PrismaRecord = PrismaPatient | PrismaNote | PrismaAppSettings;

export function convertToPrismaFormat(record: SupabaseRecord, type: 'patient' | 'note' | 'settings') {
  if (!record) return null;
  
  switch (type) {
    case 'patient': {
      const patientRecord = record as SupabasePatient;
      return {
        id: patientRecord.id,
        createdAt: new Date(patientRecord.created_at),
        updatedAt: new Date(patientRecord.updated_at),
        name: patientRecord.name,
        isDeleted: patientRecord.is_deleted,
        deletedAt: patientRecord.deleted_at ? new Date(patientRecord.deleted_at) : null,
      };
    }
    case 'note': {
      const noteRecord = record as SupabaseNote;
      return {
        id: noteRecord.id,
        createdAt: new Date(noteRecord.created_at),
        updatedAt: new Date(noteRecord.updated_at),
        patientId: noteRecord.patient_id,
        transcript: noteRecord.transcript,
        content: noteRecord.content,
        summary: noteRecord.summary,
        audioFileUrl: noteRecord.audio_file_url,
        isInitialVisit: noteRecord.is_initial_visit,
      };
    }
    case 'settings': {
      const settingsRecord = record as SupabaseAppSettings;
      return {
        id: settingsRecord.id,
        darkMode: settingsRecord.dark_mode,
        gptModel: settingsRecord.gpt_model,
        initialVisitPrompt: settingsRecord.initial_visit_prompt,
        followUpVisitPrompt: settingsRecord.follow_up_visit_prompt,
        autoSave: settingsRecord.auto_save,
        lowEchoCancellation: settingsRecord.low_echo_cancellation,
        updatedAt: new Date(settingsRecord.updated_at),
      };
    }
    default:
      return null;
  }
}

/**
 * Converts Prisma format to Supabase record format
 * @param record The Prisma record to convert
 * @returns Converted record in Supabase format
 */
export function convertToSupabaseFormat(record: PrismaRecord, type: 'patient' | 'note' | 'settings') {
  if (!record) return null;
  
  switch (type) {
    case 'patient': {
      const patientRecord = record as PrismaPatient;
      return {
        id: patientRecord.id,
        created_at: new Date(patientRecord.createdAt).toISOString(),
        updated_at: new Date(patientRecord.updatedAt).toISOString(),
        name: patientRecord.name,
        is_deleted: patientRecord.isDeleted,
        deleted_at: patientRecord.deletedAt ? new Date(patientRecord.deletedAt).toISOString() : null,
      };
    }
    case 'note': {
      const noteRecord = record as PrismaNote;
      return {
        id: noteRecord.id,
        created_at: new Date(noteRecord.createdAt).toISOString(),
        updated_at: new Date(noteRecord.updatedAt).toISOString(),
        patient_id: noteRecord.patientId,
        transcript: noteRecord.transcript,
        content: noteRecord.content,
        summary: noteRecord.summary,
        audio_file_url: noteRecord.audioFileUrl,
        is_initial_visit: noteRecord.isInitialVisit,
      };
    }
    case 'settings': {
      const settingsRecord = record as PrismaAppSettings;
      return {
        id: settingsRecord.id,
        dark_mode: settingsRecord.darkMode,
        gpt_model: settingsRecord.gptModel,
        initial_visit_prompt: settingsRecord.initialVisitPrompt,
        follow_up_visit_prompt: settingsRecord.followUpVisitPrompt,
        auto_save: settingsRecord.autoSave,
        low_echo_cancellation: settingsRecord.lowEchoCancellation,
        updated_at: new Date(settingsRecord.updatedAt).toISOString(),
      };
    }
    default:
      return null;
  }
}
