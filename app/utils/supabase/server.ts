// app/utils/supabase/server.ts
// Standard server-side client (no service-role key)

import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { SupabaseClient } from '@supabase/supabase-js';

// Environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Validate environment variables
if (!supabaseUrl || !supabaseAnon) {
  console.error(
    '[utils/supabase/server] Missing environment variables:',
    !supabaseUrl ? 'NEXT_PUBLIC_SUPABASE_URL' : '',
    !supabaseAnon ? 'NEXT_PUBLIC_SUPABASE_ANON_KEY' : ''
  );
  throw new Error(
    '[utils/supabase/server] Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY'
  );
}

/**
 * Returns a Supabase client that **does respect** RLS.
 * Safe for generic server actions & API routes.
 */
export function createClient(): SupabaseClient {
  const cookieStore = cookies();

  return createServerClient(
    supabaseUrl,
    supabaseAnon,
    {
      cookies: {
        get(name: string) {
          try {
            const cookie = cookieStore.get(name);
            return cookie?.value;
          } catch (error) {
            console.error(`[SERVER] Error getting cookie ${name}:`, error);
            return undefined;
          }
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set(name, value, {
              ...options,
              secure: process.env.NODE_ENV === 'production',
              sameSite: 'lax',
              path: '/'
            });
          } catch (error) {
            console.error(`[SERVER] Error setting cookie ${name}:`, error);
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set(name, '', {
              ...options,
              maxAge: 0,
              path: '/'
            });
          } catch (error) {
            console.error(`[SERVER] Error removing cookie ${name}:`, error);
          }
        },
      },
    }
  );
}
