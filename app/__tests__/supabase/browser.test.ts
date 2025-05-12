/**
 * @jest-environment jsdom
 */

import { describe, expect, it, jest, beforeEach, afterEach } from '@jest/globals';
import { createBrowserSupabaseClient, supabaseBrowser, updateUserProfile } from '@/app/lib/supabase/browser';

// Mock the necessary modules
jest.mock('@supabase/ssr', () => ({
  createBrowserClient: jest.fn(() => mockSupabaseClient)
}));

// Mock environment variables
const originalEnv = process.env;

// Create a mock Supabase client
const mockSupabaseClient = {
  auth: {
    getSession: jest.fn(),
    getUser: jest.fn()
  },
  from: jest.fn(() => ({
    select: jest.fn(() => ({
      eq: jest.fn(() => ({
        order: jest.fn(() => ({
          data: [],
          error: null
        }))
      }))
    })),
    update: jest.fn(() => ({
      eq: jest.fn(() => ({
        data: [],
        error: null
      }))
    }))
  }))
};

describe('Browser Supabase Client', () => {
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

  describe('createBrowserSupabaseClient', () => {
    it('should create a Supabase client when env vars are set', () => {
      const client = createBrowserSupabaseClient();
      expect(client).not.toBeNull();
    });

    it('should return null if NEXT_PUBLIC_SUPABASE_URL is missing', () => {
      process.env.NEXT_PUBLIC_SUPABASE_URL = '';
      
      const client = createBrowserSupabaseClient();
      expect(client).toBeNull();
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('[supabase/browser] Missing Supabase environment variables')
      );
    });

    it('should return null if NEXT_PUBLIC_SUPABASE_ANON_KEY is missing', () => {
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = '';
      
      const client = createBrowserSupabaseClient();
      expect(client).toBeNull();
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('[supabase/browser] Missing Supabase environment variables')
      );
    });
  });

  describe('updateUserProfile', () => {
    it('should return error if Supabase client is not initialized', async () => {
      // Simulate null client
      jest.doMock('@/app/lib/supabase/browser', () => ({
        supabaseBrowser: null
      }), { virtual: true });
      
      const result = await updateUserProfile({ username: 'test' });
      
      expect(result.success).toBe(false);
      expect(result.error).toBeInstanceOf(Error);
      expect(result.error?.message).toContain('Supabase client not initialized');
    });

    it('should update profile successfully', async () => {
      // Mock successful auth response
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'test-user-id' } },
        error: null
      });
      
      // Mock successful profile update
      const updateMock = jest.fn().mockResolvedValue({ error: null });
      mockSupabaseClient.from.mockReturnValue({
        update: jest.fn(() => ({
          eq: updateMock
        }))
      });
      
      const userData = { username: 'test-user', full_name: 'Test User' };
      const result = await updateUserProfile(userData);
      
      expect(result.success).toBe(true);
      expect(result.error).toBeNull();
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('profiles');
    });

    it('should handle errors from Supabase', async () => {
      // Mock auth response
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'test-user-id' } },
        error: null
      });
      
      // Mock error from Supabase
      const updateError = new Error('Database error');
      mockSupabaseClient.from.mockReturnValue({
        update: jest.fn(() => ({
          eq: jest.fn().mockResolvedValue({ error: updateError })
        }))
      });
      
      const result = await updateUserProfile({ username: 'test' });
      
      expect(result.success).toBe(false);
      expect(result.error).toBe(updateError);
    });

    it('should handle errors when user is not authenticated', async () => {
      // Mock null user response
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null
      });
      
      const result = await updateUserProfile({ username: 'test' });
      
      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('User not authenticated');
    });
  });
});
