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
 * Admin client for operations that need to bypass RLS (service role key):
 * - createAdminClient: Factory function for administrative operations
 * 
 * Note: No singleton is exported for security reasons.
 */
export { 
  createAdminClient
} from './admin';

/**
 * Default export for backward compatibility
 * @deprecated Use named import { supabaseServer } instead
 */
export { default } from './server';
