import { describe, expect, it, jest, beforeEach, afterEach } from '@jest/globals';
import { createServerClient, supabaseServer } from '@/app/lib/supabase/server';

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
        order: jest.fn(() => ({
          data: [],
          error: null
        }))
      }))
    }))
  }))
};

describe('Server Supabase Client', () => {
  beforeEach(() => {
    // Reset the mocks before each test
    jest.resetAllMocks();
    
    // Setup environment for tests
    process.env = { 
      ...originalEnv,
      NEXT_PUBLIC_SUPABASE_URL: 'https://test-url.supabase.co',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test-anon-key'
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

  describe('createServerClient', () => {
    it('should create a Supabase client when env vars are set', () => {
      const client = createServerClient();
      expect(client).not.toBeNull();
    });

    it('should return null if NEXT_PUBLIC_SUPABASE_URL is missing', () => {
      process.env.NEXT_PUBLIC_SUPABASE_URL = '';
      
      const client = createServerClient();
      expect(client).toBeNull();
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('[supabase/server] Missing Supabase environment variables')
      );
    });

    it('should return null if NEXT_PUBLIC_SUPABASE_ANON_KEY is missing', () => {
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = '';
      
      const client = createServerClient();
      expect(client).toBeNull();
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('[supabase/server] Missing Supabase environment variables')
      );
    });

    it('should create a client with persistSession false', () => {
      createServerClient();
      
      expect(require('@supabase/supabase-js').createClient).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.objectContaining({
          auth: expect.objectContaining({
            persistSession: false
          })
        })
      );
    });
  });

  describe('supabaseServer singleton', () => {
    it('should be initialized with valid env vars', () => {
      // Re-import the module to test the singleton behavior
      jest.resetModules();
      
      // Set up good environment variables
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test-url.supabase.co';
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
      
      // Import should initialize the singleton
      const { supabaseServer } = require('@/app/lib/supabase/server');
      
      expect(supabaseServer).not.toBeNull();
    });

    it('should be null with invalid env vars', () => {
      // Re-import the module to test the singleton behavior
      jest.resetModules();
      
      // Set up bad environment variables
      process.env.NEXT_PUBLIC_SUPABASE_URL = '';
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = '';
      
      // Import should initialize the singleton as null
      const { supabaseServer } = require('@/app/lib/supabase/server');
      
      expect(supabaseServer).toBeNull();
    });
  });

  describe('error handling', () => {
    it('should throw an error in development mode with missing env vars', () => {
      // Set to development mode
      const originalNodeEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';
      
      // Clear environment variables
      process.env.NEXT_PUBLIC_SUPABASE_URL = '';
      
      // Should throw an error in development
      expect(() => {
        jest.resetModules();
        require('@/app/lib/supabase/server');
      }).toThrow();
      
      // Restore NODE_ENV
      process.env.NODE_ENV = originalNodeEnv;
    });
  });
});
