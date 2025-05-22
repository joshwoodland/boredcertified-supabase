/**
 * @file Admin Supabase client
 * @description This file provides a Supabase client with service role key for admin operations.
 * The client bypasses Row Level Security (RLS) policies and should ONLY be used in trusted
 * server environments for administrative operations.
 */

import { createClient } from '@supabase/supabase-js';
import type { TypedSupabaseClient } from './types';

/**
 * Environment variables validation
 *
 * @description Validates the required environment variables for admin client initialization.
 * For security reasons, the service role key is only available in server environments.
 */
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Only log an error if the environment variables are missing
// Don't throw an error as it can cause the entire app to crash
if (!supabaseUrl || !serviceRoleKey) {
  const errorMsg = `[supabase/admin] Missing Supabase environment variables: ${
    !supabaseUrl ? 'NEXT_PUBLIC_SUPABASE_URL' : ''
  } ${!serviceRoleKey ? 'SUPABASE_SERVICE_ROLE_KEY' : ''}`.trim();
  console.error(errorMsg);
  // We'll handle this gracefully by returning null from createAdminClient
}

/**
 * Creates a Supabase client with service role key for admin operations
 *
 * @description Factory function that creates a new Supabase admin client instance
 * with elevated permissions. This client bypasses Row Level Security (RLS) policies
 * and has full access to all database operations.
 *
 * ⚠️ SECURITY WARNING:
 * - Only use in trusted server environments (API routes, server components, scripts)
 * - Never expose this client in browser/client code
 * - Only use for administrative or maintenance tasks that need to bypass RLS
 * - Use with caution and consider security implications of each operation
 *
 * @returns A typed Supabase client with admin privileges or null if initialization fails
 *
 * @example
 * ```typescript
 * // In a server-only API route or script
 * import { createAdminClient } from '@/app/lib/supabase';
 *
 * export async function POST(request: Request) {
 *   // Only proceed if necessary access controls are in place
 *   const isAuthorizedAdmin = await verifyAdminRequest(request);
 *   if (!isAuthorizedAdmin) {
 *     return Response.json({ error: 'Unauthorized' }, { status: 403 });
 *   }
 *
 *   // Create admin client only when needed
 *   const adminClient = createAdminClient();
 *   if (!adminClient) {
 *     return Response.json({ error: 'Admin operations unavailable' }, { status: 500 });
 *   }
 *
 *   // Perform admin operation
 *   const { error } = await adminClient
 *     .from('protected_table')
 *     .update({ status: 'approved' })
 *     .eq('id', request.id);
 *
 *   // Handle result
 *   if (error) {
 *     return Response.json({ error: error.message }, { status: 500 });
 *   }
 *   return Response.json({ success: true });
 * }
 * ```
 */
export function createAdminClient(): TypedSupabaseClient | null {
  if (!supabaseUrl || !serviceRoleKey) return null;
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
}

/**
 * No singleton instance is provided for the admin client
 *
 * @description As a security measure, we do not export a pre-initialized singleton
 * instance of the admin client. This is intentional to:
 *
 * 1. Prevent accidental usage in inappropriate contexts
 * 2. Force explicit, intentional creation of admin clients
 * 3. Make admin operations more visible in code reviews
 * 4. Allow finer-grained error handling
 *
 * Always use the createAdminClient() factory function explicitly when needed,
 * and scope the admin client to the smallest possible context.
 */
