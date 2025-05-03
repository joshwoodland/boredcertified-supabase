import { createClient } from '@supabase/supabase-js';
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { customCookieParser, convertToPrismaFormat } from './supabase';
import { createCustomServerComponentClient } from './custom-auth-adapter';
import './auth-helpers-patch'; // Import to ensure the patch is applied

// Get environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

/**
 * Creates a Supabase client for server components with cookie handling.
 * @param cookiesCallback A function that returns the cookie store from next/headers
 */
export const createServerComponentSupabaseClient = (
  cookiesCallback = () => cookies()
) => {
  try {
    return createServerComponentClient({ 
      cookies: cookiesCallback
    });
  } catch (error) {
    console.error('Error creating server component Supabase client:', error);
    // Fallback to a non-cookie client in case of errors
    return createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false }
    });
  }
};

/**
 * Safe wrapper for using Supabase with proper error handling
 * @param operation Function that uses a Supabase client
 * @param fallback Fallback value in case of error
 * @returns Result of the operation or fallback value
 */
export async function withSupabase<T>(
  operation: (client: ReturnType<typeof createServerComponentSupabaseClient>) => Promise<T>,
  fallback: T
): Promise<T> {
  try {
    // Use our custom component client for enhanced cookie handling
    const supabase = createCustomServerComponentClient();
    return await operation(supabase);
  } catch (error) {
    console.error('Error in withSupabase operation:', error);
    return fallback;
  }
}

/**
 * Fetches patients from Supabase
 * @param filterByCurrentUser Whether to filter patients by the current user's email (true by default)
 * @returns Array of patients
 */
export async function getSupabasePatients(filterByCurrentUser = true) {
  // Use our custom component client for enhanced cookie handling
  const supabaseServer = createCustomServerComponentClient();
  
  try {
    // Get current user with server-side auth
    const { data: { session } } = await supabaseServer.auth.getSession();
    const userEmail = session?.user?.email;
    
    // Build query
    let query = supabaseServer
      .from('patients')
      .select('*')
      .order('created_at', { ascending: false });
    
    // Filter by provider email if requested
    if (filterByCurrentUser && userEmail) {
      // First get patients assigned to the current user
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
    console.error('Error in getSupabasePatients:', error);
    return [];
  }
}

/**
 * Fetches notes for a specific patient from Supabase
 * @param patientId The patient's ID
 * @returns Array of notes
 */
export async function getSupabaseNotes(patientId: string) {
  // Use our custom component client for enhanced cookie handling
  const supabaseServer = createCustomServerComponentClient();
  
  try {
    const { data, error } = await supabaseServer
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
    console.error('Error in getSupabaseNotes:', error);
    return [];
  }
}

/**
 * Fetches app settings from Supabase
 * @param userId Optional user ID to fetch specific settings for
 * @returns App settings object or null if not found
 */
export async function getSupabaseAppSettings(userId?: string | null) {
  // Use our custom component client for enhanced cookie handling that properly handles base64 cookies
  const supabaseServer = createCustomServerComponentClient();
  
  try {
    // Get current user's session to access their ID if not provided
    const { data: { session } } = await supabaseServer.auth.getSession();
    const currentUserId = userId || session?.user?.id;
    
    console.log('[SETTINGS DEBUG] Auth session details:', {
      hasSession: !!session,
      userId: session?.user?.id,
      userEmail: session?.user?.email,
      cookiesPresent: true, // We're using cookies implicitly
      authCookiePresent: true // Without this we wouldn't get here
    });
    
    const query = supabaseServer.from('app_settings').select('*');
    
    // First priority: Try to get settings by user ID if available
    if (currentUserId) {
      const { data: userIdSettings, error: userIdError } = await query
        .eq('user_id', currentUserId)
        .single();
      
      if (!userIdError && userIdSettings) {
        console.log(`Found settings for user ID: ${currentUserId}`);
        return convertToPrismaFormat(userIdSettings, 'settings');
      }
      
      // If there was an error or no user ID settings found, log and fall back to default
      if (userIdError && userIdError.code !== 'PGRST116') { // PGRST116 is "no rows returned" error
        console.error(`Error fetching user settings for user ID ${currentUserId}:`, userIdError);
      } else {
        console.log(`No settings found for user ID: ${currentUserId}, falling back to default`);
      }
    } else {
      console.log('[SETTINGS DEBUG] No user found, using default settings');
    }
    
    // Fall back to default settings
    const { data: defaultSettings, error: defaultError } = await query
      .eq('id', 'default')
      .single();
    
    if (defaultError) {
      console.error('Error fetching default app settings from Supabase:', defaultError);
      console.log('[SETTINGS DEBUG] Using default settings');
      return null;
    }
    
    return convertToPrismaFormat(defaultSettings, 'settings');
  } catch (error) {
    console.error('Error in getSupabaseAppSettings:', error);
    console.log('[SETTINGS DEBUG] Using default settings');
    return null;
  }
}
