import { createClient } from '@supabase/supabase-js'

console.log('--- Loading app/lib/db.ts ---');
console.log('process.env.NEXT_PUBLIC_SUPABASE_URL (in db.ts):', process.env.NEXT_PUBLIC_SUPABASE_URL);
console.log('process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY (in db.ts):', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
console.log('-----------------------------');

// Check if we're running in the browser or on the server
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

export const supabase = createClient(supabaseUrl, supabaseAnonKey);


