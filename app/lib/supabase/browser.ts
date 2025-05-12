'use client';

/**
 * @file Browser-side Supabase client
 * @description This file provides a Supabase client for browser/client-side components, including
 * authentication handling, error management, and helper functions for common operations.
 */

import { createBrowserClient } from '@supabase/ssr';
import type { TypedSupabaseClient } from './types';

/**
 * Environment variables validation
 * 
 * These variables are critical for the Supabase client initialization.
 * The validation ensures clear error messages if they are missing.
 */
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  const errorMsg = `[supabase/browser] Missing Supabase environment variables: ${
    !supabaseUrl ? 'NEXT_PUBLIC_SUPABASE_URL' : ''
  } ${!supabaseAnonKey ? 'NEXT_PUBLIC_SUPABASE_ANON_KEY' : ''}`.trim();
  console.error(errorMsg);
  if (process.env.NODE_ENV === 'development') {
    throw new Error(errorMsg);
  }
}

/**
 * Creates a browser-side Supabase client for client components
 * 
 * @description Factory function that creates a new Supabase client instance
 * configured for browser/client-side usage. Automatically handles auth session
 * persistence and provides type safety.
 * 
 * @returns A typed Supabase client or null if initialization fails due to missing environment variables
 * 
 * @example
 * ```typescript
 * 'use client';
 * 
 * import { createBrowserSupabaseClient } from '@/app/lib/supabase';
 * 
 * function ClientComponent() {
 *   const supabase = createBrowserSupabaseClient();
 *   
 *   // Check if client was created successfully
 *   if (!supabase) {
 *     return <div>Error: Could not connect to database</div>;
 *   }
 *   
 *   // Now use the client safely...
 * }
 * ```
 */
export function createBrowserSupabaseClient(): TypedSupabaseClient | null {
  if (!supabaseUrl || !supabaseAnonKey) return null;
  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}

/**
 * Browser client singleton instance
 * 
 * @description A pre-initialized singleton instance of the browser Supabase client.
 * Use this in client components when you don't need to create a fresh client instance.
 * Will be null if environment variables are missing.
 * 
 * @example
 * ```typescript
 * 'use client';
 * 
 * import { supabaseBrowser } from '@/app/lib/supabase';
 * import { useEffect, useState } from 'react';
 * 
 * export default function ProfileComponent() {
 *   const [profile, setProfile] = useState(null);
 *   
 *   useEffect(() => {
 *     async function loadProfile() {
 *       if (!supabaseBrowser) return;
 *       
 *       const { data } = await supabaseBrowser
 *         .from('profiles')
 *         .select('*')
 *         .single();
 *         
 *       setProfile(data);
 *     }
 *     
 *     loadProfile();
 *   }, []);
 *   
 *   return profile ? <div>{profile.name}</div> : <div>Loading...</div>;
 * }
 * ```
 */
export const supabaseBrowser = 
  supabaseUrl && supabaseAnonKey ? createBrowserSupabaseClient() : null;

/**
 * Fetches patients from Supabase in browser/client context
 * 
 * @description Retrieves patient records from the database with proper error handling
 * and automatic filtering by the current user's email (via provider_email field).
 * 
 * @param filterByCurrentUser - Whether to filter patients by the current user's email.
 *                             Defaults to true. Set to false to retrieve all patients.
 * @returns An array of patient records or an empty array if retrieval fails
 * 
 * @example
 * ```typescript
 * import { getClientSupabasePatients } from '@/app/lib/supabase';
 * 
 * // In a component or event handler
 * const patients = await getClientSupabasePatients();
 * 
 * // To get all patients regardless of current user
 * const allPatients = await getClientSupabasePatients(false);
 * ```
 */
export async function getClientSupabasePatients(
  filterByCurrentUser = true
) {
  if (!supabaseBrowser) {
    console.error('[supabase/browser] Supabase client not initialized');
    return [];
  }

  const {
    data: { session },
    error: sessionError,
  } = await supabaseBrowser.auth.getSession();
  if (sessionError) {
    console.error('[supabase/browser] Error getting session:', sessionError);
    return [];
  }
  const userEmail = session?.user?.email;

  let query = supabaseBrowser
    .from('patients')
    .select('*')
    .eq('is_deleted', false)
    .order('created_at', { ascending: false });

  if (filterByCurrentUser && userEmail) {
    query = query.eq('provider_email', userEmail);
  }

  const { data, error } = await query;
  if (error) {
    console.error('[supabase/browser] Error fetching patients:', error);
    return [];
  }
  return data || [];
}

/**
 * Fetches patient notes from Supabase in browser/client context
 * 
 * @description Retrieves all notes associated with a specific patient, ordered by creation date.
 * Handles errors gracefully and provides descriptive error messages.
 * 
 * @param patientId - The ID of the patient whose notes should be retrieved
 * @returns An array of note records or an empty array if retrieval fails
 * 
 * @example
 * ```typescript
 * import { getClientSupabaseNotes } from '@/app/lib/supabase';
 * 
 * // In a component or event handler
 * const patientId = '550e8400-e29b-41d4-a716-446655440000';
 * const notes = await getClientSupabaseNotes(patientId);
 * ```
 */
export async function getClientSupabaseNotes(patientId: string) {
  if (!supabaseBrowser) {
    console.error('[supabase/browser] Supabase client not initialized');
    return [];
  }
  const { data, error } = await supabaseBrowser
    .from('notes')
    .select('*')
    .eq('patient_id', patientId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error(`[supabase/browser] Error fetching notes for ${patientId}:`, error);
    return [];
  }
  return data || [];
}

/**
 * Update user profile in Supabase
 * 
 * @description Updates user profile information in the profiles table
 * with proper error handling and type safety.
 * 
 * @param userData - Object containing the profile fields to update
 * @returns Object with success status and any error that occurred
 * 
 * @example
 * ```typescript
 * import { updateUserProfile } from '@/app/lib/supabase';
 * 
 * // In a form submit handler
 * const handleSubmit = async (formData) => {
 *   const result = await updateUserProfile({
 *     username: formData.username,
 *     full_name: formData.fullName,
 *     avatar_url: formData.avatarUrl
 *   });
 *   
 *   if (result.success) {
 *     // Show success message
 *   } else {
 *     // Handle error: result.error
 *   }
 * };
 * ```
 */
export async function updateUserProfile(userData: {
  username?: string;
  full_name?: string;
  avatar_url?: string;
}): Promise<{ success: boolean; error: Error | null }> {
  if (!supabaseBrowser) {
    return { 
      success: false, 
      error: new Error('[supabase/browser] Supabase client not initialized')
    };
  }

  try {
    const { data: { user }} = await supabaseBrowser.auth.getUser();
    
    if (!user) {
      return { 
        success: false, 
        error: new Error('[supabase/browser] User not authenticated')
      };
    }
    
    const { error } = await supabaseBrowser
      .from('profiles')
      .update(userData)
      .eq('id', user.id);
      
    return { success: !error, error: error || null };
  } catch (err) {
    return { 
      success: false, 
      error: err instanceof Error ? err : new Error(String(err)) 
    };
  }
}
