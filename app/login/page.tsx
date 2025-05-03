'use client';

import { useEffect, useState } from 'react';
import { createClient } from '../utils/supabase/client';
import { loginWithGoogle } from './actions';

export default function LoginPage() {
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const supabase = createClient();

  const handleLogin = async () => {
    try {
      setIsLoading(true);
      const result = await loginWithGoogle();
      
      if (result.error) {
        console.error('Login error:', result.error);
        alert(`Login failed: ${result.error}`);
      } else if (result.url) {
        window.location.href = result.url;
      }
    } catch (err) {
      console.error('Unexpected login error:', err);
      alert('An unexpected error occurred during login');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // Check current session
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setUserEmail(session?.user?.email ?? null);
      
      // If user is already logged in, redirect to home page
      if (session?.user?.email) {
        console.log('Existing session found, redirecting to home');
        window.location.href = '/';
      } else {
        console.log('No active session found');
      }
    };
    
    checkSession();

    // Listen for auth state changes
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      console.log('Auth state changed:', _event);
      setUserEmail(session?.user?.email ?? null);
      
      // If user becomes logged in, redirect to home page
      if (session?.user?.email) {
        console.log('User logged in, redirecting to home');
        window.location.href = '/';
      }
    });

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  return (
    <main className="flex flex-col items-center justify-center min-h-screen p-8 bg-[#1B2025]">
      <div className="flex flex-col items-center mb-8">
        <img 
          src="/logo.png" 
          alt="Bored Certified Logo" 
          className="h-96 w-auto"
        />
      </div>
      <div className="bg-[#242A32] shadow-lg rounded-xl p-8 max-w-md w-full">
        <h1 className="text-2xl font-bold mb-6 text-center text-white">Login</h1>
        
        {userEmail ? (
          <div className="text-center text-white">
            <p className="mb-4">You're logged in as:</p>
            <p className="font-semibold">{userEmail}</p>
            <p className="mt-2 text-sm text-gray-300">Redirecting to home...</p>
          </div>
        ) : (
          <>
            <button
              type="button"
              onClick={handleLogin}
              disabled={isLoading}
              className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white py-2 px-4 rounded transition transform hover:scale-105 active:scale-95 shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Loading...' : 'Login with Google'}
            </button>
          </>
        )}
      </div>
    </main>
  );
}
