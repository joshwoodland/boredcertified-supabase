'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAppSettings } from '../hooks/useAppSettings';
import type { User } from '@supabase/supabase-js';

export default function AuthSettingsTestPage() {
  const [user, setUser] = useState<User | null>(null);
  const [userLoading, setUserLoading] = useState(true);
  const [userError, setUserError] = useState<Error | null>(null);
  const { settings, isLoading: settingsLoading, error: settingsError } = useAppSettings();

  // Get the current user and their session
  useEffect(() => {
    const fetchUser = async () => {
      try {
        setUserLoading(true);
        
        // Get the current user session
        const { data: { user: currentUser }, error } = await supabase.auth.getUser();
        
        if (error) {
          throw error;
        }
        
        setUser(currentUser);
        setUserError(null);
      } catch (err) {
        console.error('Error fetching user:', err);
        setUserError(err instanceof Error ? err : new Error('Unknown error'));
      } finally {
        setUserLoading(false);
      }
    };

    fetchUser();
    
    // Subscribe to auth state changes
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  // Login with Google
  const handleLogin = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth-settings-test`,
        },
      });
      
      if (error) {
        console.error('Login error:', error);
      }
    } catch (error) {
      console.error('Login error:', error);
    }
  };

  // Logout
  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <h1 className="text-2xl font-bold mb-6">Supabase Auth + Settings Test</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* User Authentication Section */}
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-xl font-bold mb-4">User Authentication</h2>
          
          {userLoading ? (
            <p>Loading user information...</p>
          ) : userError ? (
            <p className="text-red-500">Error: {userError.message}</p>
          ) : user ? (
            <div>
              <p><strong>Logged in as:</strong> {user.email}</p>
              <p><strong>User ID:</strong> {user.id}</p>
              <p className="text-green-500 font-semibold">✅ Authenticated</p>
              <button 
                onClick={handleLogout}
                className="mt-4 bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600"
                type="button"
              >
                Logout
              </button>
            </div>
          ) : (
            <div>
              <p className="text-red-500 font-semibold">❌ Not authenticated</p>
              <button 
                onClick={handleLogin}
                className="mt-4 bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
                type="button"
              >
                Login with Google
              </button>
            </div>
          )}
        </div>
        
        {/* User Settings Section */}
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-xl font-bold mb-4">User Settings</h2>
          
          {settingsLoading ? (
            <p>Loading settings...</p>
          ) : settingsError ? (
            <p className="text-red-500">Error: {settingsError.message}</p>
          ) : settings ? (
            <div>
              <div className="mb-4">
                <h3 className="font-semibold">Associated User:</h3>
                <p>User ID: {settings.userId || 'Not set'}</p>
                <p>Email: {settings.email || 'Not set'}</p>
              </div>
              
              <div className="grid grid-cols-2 gap-2">
                <div><strong>Dark Mode:</strong></div>
                <div>{settings.darkMode ? 'Enabled' : 'Disabled'}</div>
                
                <div><strong>GPT Model:</strong></div>
                <div>{settings.gptModel}</div>
                
                <div><strong>Auto Save:</strong></div>
                <div>{settings.autoSave ? 'Enabled' : 'Disabled'}</div>
                
                <div><strong>Low Echo Cancellation:</strong></div>
                <div>{settings.lowEchoCancellation ? 'Enabled' : 'Disabled'}</div>
              </div>
            </div>
          ) : (
            <p>No settings available</p>
          )}
        </div>
      </div>
      
      {/* Full Data View */}
      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-xl font-bold mb-4">Raw User Data</h2>
          <pre className="bg-gray-100 p-4 rounded text-xs overflow-auto max-h-64">
            {user ? JSON.stringify(user, null, 2) : 'No user data'}
          </pre>
        </div>
        
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-xl font-bold mb-4">Raw Settings Data</h2>
          <pre className="bg-gray-100 p-4 rounded text-xs overflow-auto max-h-64">
            {settings ? JSON.stringify(settings, null, 2) : 'No settings data'}
          </pre>
        </div>
      </div>
    </div>
  );
}
