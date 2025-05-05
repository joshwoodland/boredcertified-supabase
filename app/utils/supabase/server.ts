'use server';

import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function createClient() {
  const cookieStore = cookies();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  // Check if environment variables are available
  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Supabase environment variables are missing on server');
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

  // Clean up URL and key to prevent any space/newline issues
  const cleanUrl = supabaseUrl.trim();
  const cleanKey = supabaseAnonKey.trim();
  console.log('Creating server-side Supabase client with URL:', cleanUrl);

  return createServerClient(
    cleanUrl,
    cleanKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  );
} 