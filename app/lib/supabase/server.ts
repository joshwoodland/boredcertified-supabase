/**
 * @file Server-side Supabase client
 * @description This file provides a Supabase client for server-side components and API routes.
 * The client uses the anonymous key and respects Row Level Security (RLS) policies.
 */

import { createClient } from '@supabase/supabase-js';
import type { TypedSupabaseClient } from './types';

/**
 * Environment variables validation
 * 
 * @description Validates the required environment variables for Supabase client initialization.
 * Provides clear error messages in development mode if variables are missing.
 */
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  const errorMsg = `[supabase/server] Missing Supabase environment variables: ${
    !supabaseUrl ? 'NEXT_PUBLIC_SUPABASE_URL' : ''
  } ${!supabaseAnonKey ? 'NEXT_PUBLIC_SUPABASE_ANON_KEY' : ''}`.trim();
  console.error(errorMsg);
  if (process.env.NODE_ENV === 'development') {
    throw new Error(errorMsg);
  }
}

/**
 * Creates a Supabase client for server-side operations
 * 
 * @description Factory function that creates a new Supabase client instance
 * configured for server-side usage with the anonymous key. This client
 * respects Row Level Security (RLS) policies and is safe for general server
 * components and API routes. Session is not persisted to avoid conflicts
 * with server-side rendering.
 * 
 * @returns A typed Supabase client or null if initialization fails
 * 
 * @example
 * ```typescript
 * // In a server component or API route
 * import { createServerClient } from '@/app/lib/supabase';
 * 
 * export async function GET(request: Request) {
 *   const supabaseServerOrNull = createServerClient();
 *   if (!supabaseServerOrNull) {
 *     return Response.json({ error: 'Database connection error' }, { status: 503 });
 *   }
 *   const supabase = supabaseServerOrNull;
 *   
 *   const { data, error } = await supabase.from('table').select('*');
 *   // Process data and respond...
 * }
 * ```
 */
export function createServerClient(): TypedSupabaseClient | null {
  if (!supabaseUrl || !supabaseAnonKey) return null;
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false }
  });
}

/**
 * Server client singleton instance
 * 
 * @description A pre-initialized singleton instance of the server Supabase client.
 * Use this in server components or API routes when you don't need to create a fresh client.
 * Will be null if environment variables are missing.
 * 
 * @example
 * ```typescript
 * // In a server component
 * import { supabaseServer } from '@/app/lib/supabase';
 * 
 * export default async function ServerComponent() {
 *   if (!supabaseServer) {
 *     throw new Error('Database connection error');
 *   }
 *   
 *   const { data, error } = await supabaseServer
 *     .from('table')
 *     .select('*');
 *     
 *   return <div>Render data here</div>;
 * }
 * ```
 */
export const supabaseServer = 
  supabaseUrl && supabaseAnonKey ? createServerClient() : null;

/**
 * Default export for backward compatibility
 * @deprecated Use named import { supabaseServer } instead
 */
export default supabaseServer;
