'use client';

import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  // Check if environment variables are available
  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Supabase environment variables are missing in client');
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
  console.log('Creating client-side Supabase client with URL:', cleanUrl);
  return createBrowserClient(cleanUrl, cleanKey);
} 