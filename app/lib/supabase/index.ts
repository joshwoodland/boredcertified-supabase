/**
 * @file Centralized exports for Supabase clients
 * @description This file provides a unified entry point for all Supabase client types,
 * instances, and helper functions. Using this central export point simplifies imports
 * across the application and allows for better code organization.
 */

// Re-export all types from the types module
export * from './types';

/**
 * Browser client exports
 * 
 * These functions and instances are designed for client-side (browser) usage:
 * - createBrowserSupabaseClient: Factory function to create new browser clients
 * - supabaseBrowser: Singleton instance for browser environments
 * - Helper functions for common client-side operations
 */
export { 
  createBrowserSupabaseClient,
  supabaseBrowser,
  getClientSupabasePatients,
  getClientSupabaseNotes,
  updateUserProfile
} from './browser';

/**
 * Server client exports
 * 
 * These functions and instances are for server-side operations that respect RLS:
 * - createServerClient: Factory function for server contexts
 * - supabaseServer: Singleton instance for general server usage
 */
export { 
  createServerClient,
  supabaseServer
} from './server';

/**
 * Admin client exports
 * 
 * Note: Admin client is NOT exported from the main index to prevent
 * client-side bundles from including server-only code that requires
 * the SUPABASE_SERVICE_ROLE_KEY environment variable.
 * 
 * To use the admin client, import directly from the admin module:
 * import { createAdminClient } from '@/app/lib/supabase/admin';
 */

/**
 * Default export for backward compatibility
 * @deprecated Use named import { supabaseServer } instead
 */
export { default } from './server';
