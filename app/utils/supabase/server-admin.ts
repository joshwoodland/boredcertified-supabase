// Service-role client factory (bypasses RLS)
import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';

// Environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// Validate environment variables
if (!supabaseUrl || !serviceRole) {
  console.error(
    '[utils/supabase/server-admin] Missing environment variables:',
    !supabaseUrl ? 'NEXT_PUBLIC_SUPABASE_URL' : '',
    !serviceRole ? 'SUPABASE_SERVICE_ROLE_KEY' : ''
  );
  throw new Error(
    '[utils/supabase/server-admin] Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY'
  );
}

/**
 * Returns a **service-role** Supabase client.
 * Keep it inside trusted server code only.
 */
export async function createAdminClient(): Promise<SupabaseClient> {
  // Async to match your existing call sites
  return createClient(supabaseUrl, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
