import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/app/utils/supabase/server';
import { createBrowserSupabaseClient } from '@/app/lib/supabase';

// Check if we're in a browser environment
const isClient = typeof window !== 'undefined';

// Environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Initialize Supabase client with appropriate environment variables
console.log('db.ts - Initializing Supabase client. isClient:', isClient, 'URL:', supabaseUrl);

// Use the public anon key for both client and server in this context,
// as RLS should handle permissions. Use serverSupabase from supabase.ts for admin tasks.
if (!supabaseUrl || !supabaseAnonKey) {
  console.error('db.ts - Supabase URL or Anon Key is missing!');
}

/**
 * DEPRECATED: Use standardized client initialization methods instead.
 * For client-side: import { createBrowserSupabaseClient } from '@/app/lib/supabase'
 * For server-side: import { createClient } from '@/app/utils/supabase/server'
 */
export const supabase = isClient
  ? createBrowserSupabaseClient()
  : createClient();

/**
 * Get a Supabase client using the standardized method.
 * @returns A Supabase client appropriate for the current environment
 */
export function getSupabaseClient() {
  console.warn('db.ts - getSupabaseClient is deprecated. Use standardized client initialization methods instead.');
  return isClient
    ? createBrowserSupabaseClient()
    : createClient();
}
