/**
 * @file Shared Supabase types
 * @description This file provides type definitions and utility functions for Supabase interactions,
 * ensuring consistent typing across browser, server, and admin clients.
 * @module app/lib/supabase/types
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { 
  SupabasePatient, 
  SupabaseNote, 
  SupabaseSettings, 
  AppPatient,
  AppNote,
  AppSettings,
  SupabaseRecord,
  AppRecord,
  convertToAppFormat,
  convertToSupabaseFormat
} from '@/app/lib/supabaseTypes';

/**
 * Re-export types from the existing supabaseTypes to maintain a centralized type system.
 * This allows consumers to import all types from this module without needing to know
 * about the underlying implementation details.
 */
export * from '@/app/lib/supabaseTypes';

/**
 * TypedSupabaseClient
 * 
 * @description A strongly typed Supabase client that provides full type checking for database operations.
 * This type is used across browser, server, and admin clients to ensure consistent typing.
 * 
 * @example
 * ```typescript
 * // Creating a typed client
 * const client: TypedSupabaseClient = createBrowserSupabaseClient();
 * 
 * // Using the typed client with full type checking
 * const { data, error } = await client
 *   .from('patients')
 *   .select('*')
 *   .eq('provider_email', email);
 * 
 * // Type-safe access to user data
 * const { data: { user } } = await client.auth.getUser();
 * ```
 */
export type TypedSupabaseClient = SupabaseClient;

/**
 * Database record conversion result type 
 * @template T The type of record being returned
 */
export type ConversionResult<T> = T | null;

/**
 * Extends the basic conversion utility with more detailed documentation
 * 
 * @description Wraps the convertToAppFormat function from supabaseTypes with improved error handling and logging.
 * 
 * @param entity - The raw entity from Supabase
 * @param type - The entity type ('patient', 'note', or 'settings')
 * @returns Formatted entity for application use or null if conversion fails
 * 
 * @example
 * ```typescript
 * const { data } = await supabaseClient.from('patients').select('*').eq('id', patientId);
 * const patient = convertEntityToAppFormat(data[0], 'patient');
 * if (patient) {
 *   // Work with the strongly-typed patient object
 *   console.log(patient.name, patient.createdAt);
 * }
 * ```
 * 
 * @throws Will log an error if conversion fails but returns null rather than throwing
 */
export function convertEntityToAppFormat<T extends 'patient' | 'note' | 'settings'>(
  entity: SupabaseRecord,
  type: T
): ConversionResult<
  T extends 'patient' ? AppPatient : 
  T extends 'note' ? AppNote : 
  T extends 'settings' ? AppSettings : 
  never
> {
  try {
    // Use type assertion with a specific return type instead of 'any'
    return convertToAppFormat(entity, type) as ConversionResult<
      T extends 'patient' ? AppPatient : 
      T extends 'note' ? AppNote : 
      T extends 'settings' ? AppSettings : 
      never
    >;
  } catch (error) {
    console.error(`[supabase/types] Error converting ${type} entity to app format:`, error);
    return null;
  }
}
