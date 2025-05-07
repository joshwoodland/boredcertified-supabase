import { createClient } from '@supabase/supabase-js';
import { createBrowserClient } from '@supabase/ssr';
import { createClient as createClientSideClient } from '@/app/utils/supabase/client';

console.log('--- Loading app/lib/supabase.ts ---');
console.log('process.env.NEXT_PUBLIC_SUPABASE_URL (in supabase.ts):', process.env.NEXT_PUBLIC_SUPABASE_URL);
console.log('process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY (in supabase.ts):', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
console.log('process.env.SUPABASE_SERVICE_ROLE_KEY (in supabase.ts):', process.env.SUPABASE_SERVICE_ROLE_KEY);
console.log('---------------------------------');

// Check if we're running in the browser or on the server
const isClient = typeof window !== 'undefined';

// Get environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

/**
 * Creates a Supabase client for browser usage.
 * This should be used in client components.
 */
export const createBrowserSupabaseClient = () => {
  // Check if environment variables are available
  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Supabase environment variables are missing');
    // Return a dummy client to prevent application crashes
    return {
      from: () => ({
        select: () => ({ data: null, error: new Error('Supabase configuration missing') }),
        insert: () => ({ data: null, error: new Error('Supabase configuration missing') }),
        update: () => ({ data: null, error: new Error('Supabase configuration missing') }),
        delete: () => ({ data: null, error: new Error('Supabase configuration missing') }),
        eq: () => ({ data: null, error: new Error('Supabase configuration missing') }),
      }),
      auth: {
        getSession: async () => ({ data: { session: null }, error: null }),
        getUser: async () => ({ data: { user: null }, error: null }),
        signOut: async () => ({ error: null }),
      },
    } as any;
  }
  
  // Create and return the actual client when environment variables are available
  // Ensure URL doesn't have any unexpected spaces or line breaks
  const cleanUrl = supabaseUrl.trim();
  const cleanKey = supabaseAnonKey.trim();
  console.log('Creating Supabase client with URL:', cleanUrl);
  return createBrowserClient(cleanUrl, cleanKey);
};

/**
 * Singleton browser client
 * Only used in client components or when isomorphic behavior is required
 */
export const supabase = createBrowserSupabaseClient();

/**
 * Creates a Supabase admin client using the service role key.
 * This bypasses RLS policies and should only be used in trusted server contexts.
 * CAUTION: Never expose this client to the browser.
 */
export const createAdminSupabaseClient = () => 
  createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      persistSession: false,
    }
  });

// Server-side Supabase client for API routes
export const serverSupabase = (() => {
  // Define dummy chain for error cases
  const dummyChain = {
    select: () => ({ data: null, error: new Error('Supabase configuration missing') }),
    insert: () => ({ data: null, error: new Error('Supabase configuration missing') }),
    update: () => ({ data: null, error: new Error('Supabase configuration missing') }),
    delete: () => ({ data: null, error: new Error('Supabase configuration missing') }),
    eq: () => ({ data: null, error: new Error('Supabase configuration missing') }),
    then: (onfulfilled: any) => {
      if (onfulfilled) {
        onfulfilled({ data: null, error: new Error('Supabase configuration missing') });
      }
      return Promise.resolve({ data: null, error: new Error('Supabase configuration missing') });
    }
  };

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Supabase service role key is missing');
    return {
      from: () => dummyChain,
      auth: {
        getSession: async () => ({ data: { session: null }, error: null }),
        getUser: async () => ({ data: { user: null }, error: null }),
      },
    } as any;
  }
  
  // Clean up URL and key to prevent any space/newline issues
  const cleanUrl = supabaseUrl.trim();
  const cleanKey = supabaseServiceKey.trim();

  // Add detailed logging
  console.log('Supabase Initialization Debug:');
  console.log('- supabaseUrl (raw):', supabaseUrl);
  console.log('- supabaseServiceKey exists:', !!supabaseServiceKey);
  console.log('- cleanUrl:', cleanUrl);
  console.log('- cleanKey exists:', !!cleanKey);
  console.log('- isClient:', isClient);

  if (!cleanUrl || cleanUrl === 'undefined') {
    console.error('Supabase URL is missing or invalid');
    return {
      from: () => dummyChain,
      auth: {
        getSession: async () => ({ data: { session: null }, error: null }),
        getUser: async () => ({ data: { user: null }, error: null }),
      },
    } as any;
  }

  if (!cleanKey || cleanKey === 'undefined') {
    console.error('Supabase Service Key is missing or invalid');
    return {
      from: () => dummyChain,
      auth: {
        getSession: async () => ({ data: { session: null }, error: null }),
        getUser: async () => ({ data: { user: null }, error: null }),
      },
    } as any;
  }

  console.log('Creating server API Supabase client with URL:', cleanUrl);
  
  return createClient(cleanUrl, cleanKey, {
    auth: {
      persistSession: false,
    }
  });
})();

/**
 * Checks if the Supabase connection is available
 * @returns True if connection is successful, false otherwise
 */
export async function checkSupabaseConnection(): Promise<boolean> {
  try {
    if (isClient) {
      const { data, error } = await supabase.from('patients').select('id').limit(1);
      if (error && error.code !== '42P01') { // 42P01 means table doesn't exist, which is fine
        console.error('Supabase connection error:', error);
        return false;
      }
    } else {
      const { data, error } = await serverSupabase.from('patients').select('id').limit(1);
      if (error && error.code !== '42P01') {
        console.error('Supabase server connection error:', error);
        return false;
      }
    }
    return true;
  } catch (error) {
    console.error('Failed to connect to Supabase:', error);
    return false;
  }
}

/**
 * CLIENT-SIDE ONLY: Fetches patients from Supabase
 * @param filterByCurrentUser Whether to filter patients by the current user's email (true by default)
 * @returns Array of patients
 */
export async function getClientSupabasePatients(filterByCurrentUser = true) {
  if (!isClient) {
    console.error('getClientSupabasePatients should only be called from client components');
    return [];
  }
  
  try {
    // Always use client-side Supabase in this client component
    const clientSupabase = supabase;
    
    // Get current user with auth
    const { data: { session } } = await clientSupabase.auth.getSession();
    const userEmail = session?.user?.email;
    
    // Build query
    let query = clientSupabase
      .from('patients')
      .select('*')
      .order('created_at', { ascending: false });
    
    // Filter by provider email if requested
    if (filterByCurrentUser && userEmail) {
      query = query.eq('provider_email', userEmail);
      console.log(`Filtering patients for provider email: ${userEmail}`);
    }
    
    const { data, error } = await query;
    
    if (error) {
      console.error('Error fetching patients from Supabase:', error);
      return [];
    }
    
    return data || [];
  } catch (error) {
    console.error('Error in getClientSupabasePatients:', error);
    return [];
  }
}

/**
 * SERVER-SIDE ONLY: Fetches patients from Supabase
 * This is meant to be used in API routes and server components
 */
export async function getSupabasePatients(providerEmail?: string | null) {
  try {
    let query = serverSupabase
      .from('patients')
      .select('*')
      .eq('is_deleted', false)
      .order('created_at', { ascending: false });
    
    // Filter by provider email if provided
    if (providerEmail) {
      query = query.eq('provider_email', providerEmail);
    }
    
    const { data, error } = await query;
    
    if (error) {
      console.error('Error fetching patients from server-side Supabase:', error);
      return [];
    }
    
    return data || [];
  } catch (error) {
    console.error('Error in getSupabasePatients (server-side):', error);
    return [];
  }
}

/**
 * CLIENT-SIDE ONLY: Fetches notes for a specific patient from Supabase
 */
export async function getClientSupabaseNotes(patientId: string) {
  if (!isClient) {
    console.error('getClientSupabaseNotes should only be called from client components');
    return [];
  }
  
  try {
    const clientSupabase = supabase;
    
    const { data, error } = await clientSupabase
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
    console.error('Error in getClientSupabaseNotes:', error);
    return [];
  }
}

/**
 * SERVER-SIDE ONLY: Fetches notes for a specific patient from Supabase
 * This is meant to be used in API routes and server components
 */
export async function getSupabaseNotes(patientId: string) {
  try {
    const { data, error } = await serverSupabase
      .from('notes')
      .select('*')
      .eq('patient_id', patientId)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error(`Error fetching notes for patient ${patientId} from server-side Supabase:`, error);
      return [];
    }
    
    return data || [];
  } catch (error) {
    console.error('Error in getSupabaseNotes (server-side):', error);
    return [];
  }
}

/**
 * Converts Supabase record format to application format
 * @param record The Supabase record to convert
 * @param type The type of record being converted
 * @returns Converted record in application format
 */
export interface SupabasePatient {
  id: string;
  created_at: string;
  updated_at: string;
  name: string;
  is_deleted: boolean;
  deleted_at: string | null;
  provider_email: string | null;
}

export interface SupabaseNote {
  id: string;
  created_at: string;
  updated_at: string;
  patient_id: string;
  transcript: string;
  content: string;
  summary: string | null;
  is_initial_visit: boolean;
}

export interface SupabaseAppSettings {
  id: string;
  dark_mode: boolean;
  gpt_model: string;
  initial_visit_prompt: string;
  follow_up_visit_prompt: string;
  auto_save: boolean;
  low_echo_cancellation: boolean;
  email: string | null;
  user_id: string | null;
  updated_at: string;
}

type SupabaseRecord = SupabasePatient | SupabaseNote | SupabaseAppSettings;

export interface AppPatient {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  name: string;
  isDeleted: boolean;
  deletedAt: Date | null;
  providerEmail: string | null;
}

export interface AppNote {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  patientId: string;
  transcript: string;
  content: string;
  summary: string | null;
  isInitialVisit: boolean;
}

export interface AppSettings {
  id: string;
  darkMode: boolean;
  gptModel: string;
  initialVisitPrompt: string;
  followUpVisitPrompt: string;
  autoSave: boolean;
  lowEchoCancellation: boolean;
  email: string | null;
  userId: string | null;
  updatedAt: Date;
}

type AppRecord = AppPatient | AppNote | AppSettings;

/**
 * Converts Supabase record format to application format
 * @param record The Supabase record to convert
 * @param type The type of record being converted
 * @returns Converted record in application format
 */
export function convertToAppFormat(record: SupabaseRecord, type: 'patient' | 'note' | 'settings') {
  if (!record) return null;

  if (type === 'patient') {
    const patientRecord = record as SupabasePatient;
    return {
      id: patientRecord.id,
      createdAt: new Date(patientRecord.created_at),
      updatedAt: new Date(patientRecord.updated_at),
      name: patientRecord.name,
      isDeleted: patientRecord.is_deleted,
      deletedAt: patientRecord.deleted_at ? new Date(patientRecord.deleted_at) : null,
      providerEmail: patientRecord.provider_email
    } as AppPatient;
  }

  if (type === 'note') {
    const noteRecord = record as SupabaseNote;
    return {
      id: noteRecord.id,
      createdAt: new Date(noteRecord.created_at),
      updatedAt: new Date(noteRecord.updated_at),
      patientId: noteRecord.patient_id,
      transcript: noteRecord.transcript,
      content: noteRecord.content,
      summary: noteRecord.summary,
      isInitialVisit: noteRecord.is_initial_visit
    } as AppNote;
  }

  if (type === 'settings') {
    const settingsRecord = record as SupabaseAppSettings;
    return {
      id: settingsRecord.id,
      darkMode: settingsRecord.dark_mode,
      gptModel: settingsRecord.gpt_model,
      initialVisitPrompt: settingsRecord.initial_visit_prompt,
      followUpVisitPrompt: settingsRecord.follow_up_visit_prompt,
      autoSave: settingsRecord.auto_save,
      lowEchoCancellation: settingsRecord.low_echo_cancellation,
      email: settingsRecord.email,
      userId: settingsRecord.user_id,
      updatedAt: new Date(settingsRecord.updated_at)
    } as AppSettings;
  }

  return null;
}

/**
 * Converts application format to Supabase record format
 * @param record The application record to convert
 * @param type The type of record being converted
 * @returns Converted record in Supabase format
 */
export function convertToSupabaseFormat(record: AppRecord, type: 'patient' | 'note' | 'settings') {
  if (!record) return null;

  if (type === 'patient') {
    const patientRecord = record as AppPatient;
    return {
      id: patientRecord.id,
      created_at: patientRecord.createdAt.toISOString(),
      updated_at: patientRecord.updatedAt.toISOString(),
      name: patientRecord.name,
      is_deleted: patientRecord.isDeleted,
      deleted_at: patientRecord.deletedAt?.toISOString() || null,
      provider_email: patientRecord.providerEmail
    } as SupabasePatient;
  }

  if (type === 'note') {
    const noteRecord = record as AppNote;
    return {
      id: noteRecord.id,
      created_at: noteRecord.createdAt.toISOString(),
      updated_at: noteRecord.updatedAt.toISOString(),
      patient_id: noteRecord.patientId,
      transcript: noteRecord.transcript,
      content: noteRecord.content,
      summary: noteRecord.summary,
      is_initial_visit: noteRecord.isInitialVisit
    } as SupabaseNote;
  }

  if (type === 'settings') {
    const settingsRecord = record as AppSettings;
    return {
      id: settingsRecord.id,
      dark_mode: settingsRecord.darkMode,
      gpt_model: settingsRecord.gptModel,
      initial_visit_prompt: settingsRecord.initialVisitPrompt,
      follow_up_visit_prompt: settingsRecord.followUpVisitPrompt,
      auto_save: settingsRecord.autoSave,
      low_echo_cancellation: settingsRecord.lowEchoCancellation,
      email: settingsRecord.email,
      user_id: settingsRecord.userId,
      updated_at: settingsRecord.updatedAt.toISOString()
    } as SupabaseAppSettings;
  }

  return null;
}
