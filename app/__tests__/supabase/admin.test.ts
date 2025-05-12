import { describe, expect, it, jest, beforeEach, afterEach } from '@jest/globals';
import { createAdminClient } from '@/app/lib/supabase/admin';

// Mock the necessary modules
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => mockSupabaseClient)
}));

// Mock environment variables
const originalEnv = process.env;

// Create a mock Supabase client
const mockSupabaseClient = {
  auth: {
    getUser: jest.fn(),
    getSession: jest.fn()
  },
  from: jest.fn(() => ({
    select: jest.fn(() => ({
      eq: jest.fn(() => ({
        data: [],
        error: null
      }))
    })),
    insert: jest.fn(() => ({
      select: jest.fn(() => ({
        data: [],
        error: null
      }))
    })),
    update: jest.fn(() => ({
      eq: jest.fn(() => ({
        data: [],
        error: null
      }))
    })),
    delete: jest.fn(() => ({
      eq: jest.fn(() => ({
        data: [],
        error: null
      }))
    }))
  }))
};

describe('Admin Supabase Client', () => {
  beforeEach(() => {
    // Reset the mocks before each test
    jest.resetAllMocks();
    
    // Setup environment for tests
    process.env = { 
      ...originalEnv,
      NEXT_PUBLIC_SUPABASE_URL: 'https://test-url.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key'
    };
    
    // Mock the console to avoid polluting test output
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });
  
  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
    
    // Restore console
    jest.restoreAllMocks();
  });

  describe('createAdminClient', () => {
    it('should create a Supabase client when env vars are set', () => {
      const client = createAdminClient();
      expect(client).not.toBeNull();
    });

    it('should return null if NEXT_PUBLIC_SUPABASE_URL is missing', () => {
      process.env.NEXT_PUBLIC_SUPABASE_URL = '';
      
      const client = createAdminClient();
      expect(client).toBeNull();
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('[supabase/admin] Missing Supabase environment variables')
      );
    });

    it('should return null if SUPABASE_SERVICE_ROLE_KEY is missing', () => {
      process.env.SUPABASE_SERVICE_ROLE_KEY = '';
      
      const client = createAdminClient();
      expect(client).toBeNull();
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('[supabase/admin] Missing Supabase environment variables')
      );
    });

    it('should create a client with persistSession and autoRefreshToken set to false', () => {
      createAdminClient();
      
      expect(require('@supabase/supabase-js').createClient).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.objectContaining({
          auth: expect.objectContaining({
            persistSession: false,
            autoRefreshToken: false
          })
        })
      );
    });
  });

  describe('error handling', () => {
    it('should throw an error in development mode with missing env vars', () => {
      // Save original NODE_ENV
      const originalNodeEnv = process.env.NODE_ENV;
      
      try {
        // Set to development mode
        Object.defineProperty(process.env, 'NODE_ENV', {
          value: 'development',
          writable: true,
          configurable: true
        });
        
        // Clear environment variables
        process.env.SUPABASE_SERVICE_ROLE_KEY = '';
        
        // Should throw an error in development
        expect(() => {
          jest.resetModules();
          require('@/app/lib/supabase/admin');
        }).toThrow();
      } finally {
        // Restore NODE_ENV
        Object.defineProperty(process.env, 'NODE_ENV', {
          value: originalNodeEnv,
          writable: true,
          configurable: true
        });
      }
    });
  });

  describe('security measures', () => {
    it('should not export a singleton instance', () => {
      jest.resetModules();
      const adminModule = require('@/app/lib/supabase/admin');
      
      // The admin module should not have a supabaseAdmin export
      expect(adminModule.supabaseAdmin).toBeUndefined();
    });
  });
});
