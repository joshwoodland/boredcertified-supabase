'use client';

/**
 * @deprecated This module is deprecated in favor of the standardized supabase client.
 * Please import from '@/app/lib/supabase' instead.
 * Example: import { createBrowserSupabaseClient, supabaseBrowser } from '@/app/lib/supabase'
 */

import { createBrowserSupabaseClient, supabaseBrowser } from '@/app/lib/supabase';
import { TypedSupabaseClient } from '@/app/lib/supabase';

/**
 * @deprecated Use createBrowserSupabaseClient() or the singleton supabaseBrowser from '@/app/lib/supabase' instead
 */
export function createClient(): TypedSupabaseClient | null {
  console.warn(
    '[DEPRECATED] app/utils/supabase/client.ts is deprecated. ' +
    'Please use imports from @/app/lib/supabase instead.'
  );
  return supabaseBrowser;
}

// Re-export for backwards compatibility
export { supabaseBrowser as supabase };
