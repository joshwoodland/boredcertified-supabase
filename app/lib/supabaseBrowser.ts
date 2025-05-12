// Remove 'use client'; directive as this file will be used for server-side operations

import { createClient } from '@supabase/supabase-js';

/* ─────── Validate env vars ─────── */
const supabaseUrl = process.env.SUPABASE_URL; // Use the server-side URL
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // Use the service role key

if (!supabaseUrl || !supabaseServiceRoleKey) {
  const errorMsg = `[supabaseBrowser] Missing Supabase environment variables: ${
    !supabaseUrl ? 'SUPABASE_URL' : ''
  } ${!supabaseServiceRoleKey ? 'SUPABASE_SERVICE_ROLE_KEY' : ''}`.trim();
  console.error(errorMsg);
  if (process.env.NODE_ENV === 'development') {
    throw new Error(errorMsg);
  }
}

/* ─────── Helper factory ─────── */
export const createServerSupabaseClient = () =>
  createClient(supabaseUrl!, supabaseServiceRoleKey!);

/* ─────── Singleton (optional) ─────── */
export const supabase =
  supabaseUrl && supabaseServiceRoleKey ? createServerSupabaseClient() : null;

/* ─────── Convenience helpers ─────── */

export async function getServerSupabasePatients(
  filterByCurrentUser = true
) {
  if (!supabase) {
    console.error('[supabaseBrowser] Supabase client not initialized');
    return [];
  }

  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) {
    console.error('[supabaseBrowser] Error getting session:', sessionError);
    return [];
  }
  const userEmail = session?.user?.email;

  let query = supabase
    .from('patients')
    .select('*')
    .eq('is_deleted', false)
    .order('created_at', { ascending: false });

  if (filterByCurrentUser && userEmail) {
    query = query.eq('provider_email', userEmail);
  }

  const { data, error } = await query;
  if (error) {
    console.error('[supabaseBrowser] Error fetching patients:', error);
    return [];
  }
  return data || [];
}

export async function getServerSupabaseNotes(patientId: string) {
  if (!supabase) {
    console.error('[supabaseBrowser] Supabase client not initialized');
    return [];
  }
  const { data, error } = await supabase
    .from('notes')
    .select('*')
    .eq('patient_id', patientId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error(`[supabaseBrowser] Error fetching notes for ${patientId}:`, error);
    return [];
  }
  return data || [];
}