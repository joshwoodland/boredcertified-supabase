
import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/app/utils/supabase/server-admin';

// Debug logging to help diagnose environment variable issues
console.log('[lib/supabaseServer] Initializing server-side Supabase client');
console.log('[lib/supabaseServer] NEXT_PUBLIC_SUPABASE_URL exists:', !!process.env.NEXT_PUBLIC_SUPABASE_URL);
console.log('[lib/supabaseServer] SUPABASE_SERVICE_ROLE_KEY exists:', !!process.env.SUPABASE_SERVICE_ROLE_KEY);

// Get environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Validate environment variables
if (!supabaseUrl || !serviceRole) {
  console.error('[lib/supabaseServer] Missing required environment variables:',
    !supabaseUrl ? 'NEXT_PUBLIC_SUPABASE_URL' : '',
    !serviceRole ? 'SUPABASE_SERVICE_ROLE_KEY' : ''
  );

  if (process.env.NODE_ENV === 'development') {
    console.error('[lib/supabaseServer] Make sure your .env.local file contains these variables and that Next.js is loading them correctly.');
    console.error('[lib/supabaseServer] Try restarting your Next.js development server.');
  }

  throw new Error(
    '[lib/supabaseServer] Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY'
  );
}

/**
 * DEPRECATED: Use createAdminClient() from @/app/utils/supabase/server-admin instead.
 * This is kept for backward compatibility.
 */
export const supabase: SupabaseClient = createClient(
  supabaseUrl,
  serviceRole,
  {
    auth: { persistSession: false, autoRefreshToken: false },
  }
);

/**
 * DEPRECATED: Use createAdminClient() from @/app/utils/supabase/server-admin instead.
 * This is kept for backward compatibility.
 */
export default supabase;

/**
 * Get a Supabase admin client using the standardized method.
 * @returns A Supabase client with admin privileges
 */
export async function getAdminClient(): Promise<SupabaseClient> {
  console.warn('[lib/supabaseServer] getAdminClient is deprecated. Use createAdminClient from @/app/utils/supabase/server-admin instead.');
  return await createAdminClient();
}
