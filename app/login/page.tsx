'use client';

import { useEffect, useState, useRef } from 'react';
import { createClient } from '../utils/supabase/client';
import { loginWithGoogle } from './actions';

export default function LoginPage() {
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);
  const supabase = createClient();

  const handleLogin = async () => {
    setError(null);
    try {
      setIsLoading(true);
      console.log('[AUTH] Initiating login with Google');
      const result = await loginWithGoogle();
      
      if (result.error) {
        console.error('[AUTH] Login error:', result.error);
        setError(`Login failed: ${result.error}`);
      } else if (result.url) {
        console.log('[AUTH] Redirecting to OAuth provider URL');
        window.location.href = result.url;
      } else {
        setError('Could not initiate login. Please try again.');
      }
    } catch (err) {
      console.error('[AUTH] Unexpected login error:', err);
      setError('An unexpected error occurred during login. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // Check current session
    const checkSession = async () => {
      setIsCheckingSession(true);
      try {
        console.log('[AUTH] Checking for existing session');
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('[AUTH] Error getting session:', error.message);
          return null;
        }
        
        setUserEmail(session?.user?.email ?? null);
        
        // If user is already logged in, redirect to home page
        if (session?.user?.email) {
          console.log('[AUTH] Existing session found, redirecting to home');
          window.location.href = '/';
        } else {
          console.log('[AUTH] No active session found');
        }
      } catch (err) {
        console.error('[AUTH] Unexpected error checking session:', err);
      } finally {
        setIsCheckingSession(false);
      }
    };
    
    checkSession();

    // Listen for auth state changes
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      console.log('[AUTH] Auth state changed:', _event);
      setUserEmail(session?.user?.email ?? null);
      
      // If user becomes logged in, redirect to home page
      if (session?.user?.email) {
        console.log('[AUTH] User logged in, redirecting to home');
        window.location.href = '/';
      }
    });

    // Play video background silently and loop
    if (videoRef.current) {
      videoRef.current.play().catch(err => {
        console.log('Video autoplay prevented by browser:', err);
      });
    }

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  return (
    <main className="flex flex-col items-center justify-center min-h-screen p-8 bg-[#1B2025] relative overflow-hidden">
      {/* Video Background */}
      <div className="video-background absolute inset-0 w-full h-full z-0">
        <video 
          ref={videoRef}
          className="absolute inset-0 w-full h-full object-cover opacity-30"
          autoPlay
          loop
          muted
          playsInline
          poster="/video-poster.png"
        >
          <source src="/background.mp4" type="video/mp4" />
          Your browser does not support the video tag.
        </video>
        <div className="absolute inset-0 bg-gradient-to-t from-[#1B2025] via-transparent to-transparent opacity-70"></div>
      </div>
      
      <div className="flex flex-col items-center mb-8 relative z-10">
        <img 
          src="/logo.png" 
          alt="Bored Certified Logo" 
          className="h-96 w-auto"
        />
      </div>
      <div className="bg-[#242A32]/80 backdrop-blur-md shadow-lg rounded-xl p-8 max-w-md w-full relative z-10">
        <h1 className="text-2xl font-bold mb-6 text-center text-white">Login</h1>
        
        {isCheckingSession ? (
          <div className="text-center text-white">
            <div className="inline-block w-6 h-6 border-2 border-t-blue-500 border-r-transparent border-b-transparent border-l-transparent rounded-full animate-spin mb-2"></div>
            <p>Checking session...</p>
          </div>
        ) : userEmail ? (
          <div className="text-center text-white">
            <p className="mb-4">You're logged in as:</p>
            <p className="font-semibold">{userEmail}</p>
            <p className="mt-2 text-sm text-gray-300">Redirecting to home...</p>
          </div>
        ) : (
          <>
            {error && (
              <div className="mb-4 p-3 bg-red-500/20 border border-red-500/30 rounded-md">
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            )}
            <button
              type="button"
              onClick={handleLogin}
              disabled={isLoading}
              className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white py-2 px-4 rounded transition transform hover:scale-105 active:scale-95 shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <span className="flex items-center justify-center">
                  <span className="inline-block w-4 h-4 border-2 border-t-white border-r-transparent border-b-transparent border-l-transparent rounded-full animate-spin mr-2"></span>
                  Connecting...
                </span>
              ) : (
                'Login with Google'
              )}
            </button>
          </>
        )}
      </div>
    </main>
  );
}
