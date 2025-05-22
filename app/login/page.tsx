'use client';

import { useEffect, useState, useRef } from 'react';
import { createBrowserSupabaseClient } from '@/app/lib/supabase';
import { loginWithGoogle } from './actions';
import DynamicLogo from '../components/DynamicLogo';
import { useRouter } from 'next/navigation';
import { Session } from '@supabase/supabase-js';
import { debugClientCookies } from '@/app/utils/cookies';

export default function LoginPage() {
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [videoLoaded, setVideoLoaded] = useState(false);
  const [canAutoplay, setCanAutoplay] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const supabase = createBrowserSupabaseClient();
  const router = useRouter();

  const handleGoogleLogin = async () => {
    try {
      setIsLoading(true);
      setError(null);

      console.log('[LOGIN] Starting Google OAuth login flow');

      // Get the current origin for the redirect URL
      const origin = window.location.origin;
      const redirectUrl = `${origin}/auth/callback`;

      console.log('[LOGIN] Using redirect URL:', redirectUrl);

      // Check if Supabase client is initialized
      if (!supabase) {
        const errorMsg = 'Supabase client not initialized';
        console.error(`[LOGIN] ${errorMsg}`);
        throw new Error(errorMsg);
      }

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      });

      if (error) {
        console.error('[LOGIN] OAuth error:', error);
        throw error;
      }

      // Redirect to OAuth provider URL
      if (data?.url) {
        console.log('[LOGIN] Redirecting to OAuth provider URL');
        window.location.href = data.url;
      } else {
        console.error('[LOGIN] No URL returned from OAuth provider');
        throw new Error('No URL returned from OAuth provider');
      }
    } catch (error) {
      console.error('[LOGIN] Error during Google login:', error);
      setError(error instanceof Error ? error.message : 'Failed to login with Google');
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const checkSession = async () => {
      try {
        console.log('[LOGIN] Checking for existing session');

        // Check for auth cookies in the browser using standardized function
        const hasAuthCookies = debugClientCookies('LOGIN');

        // Check if Supabase client is initialized
        if (!supabase) {
          const errorMsg = 'Supabase client not initialized';
          console.error(`[LOGIN] ${errorMsg}`);
          setError(errorMsg);
          setIsCheckingSession(false);
          return;
        }

        const { data: { session }, error } = await supabase.auth.getSession();

        if (error) {
          console.error('[LOGIN] Error checking session:', error);
          throw error;
        }

        if (session) {
          console.log('[LOGIN] Session found for user:', session.user.email);

          // Set the email for display while redirecting
          setUserEmail(session.user.email || null);

          // Redirect to home page
          router.push('/');
        } else {
          console.log('[LOGIN] No session found');

          // If we have auth cookies but no session, try to refresh
          if (hasAuthCookies) {
            console.log('[LOGIN] Auth cookies present but no session, attempting refresh');
            try {
              const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();

              if (refreshError) {
                console.error('[LOGIN] Error refreshing session:', refreshError);
              } else if (refreshData.session) {
                console.log('[LOGIN] Session refreshed successfully for user:', refreshData.session.user.email);
                setUserEmail(refreshData.session.user.email || null);
                router.push('/');
                return;
              }
            } catch (refreshError) {
              console.error('[LOGIN] Exception during session refresh:', refreshError);
            }
          }
        }
      } catch (error) {
        console.error('[LOGIN] Error checking session:', error);
        setError(error instanceof Error ? error.message : 'Failed to check session');
      } finally {
        setIsCheckingSession(false);
      }
    };

    checkSession();
  }, [router, supabase]);

  useEffect(() => {
    console.log('[LOGIN] Setting up auth state change listener');

    // Check if Supabase client is initialized
    if (!supabase) {
      console.error('[LOGIN] Cannot set up auth listener - Supabase client not initialized');
      return () => {}; // Return empty cleanup function
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event: string, session: any) => {
      console.log(`[LOGIN] Auth state changed: ${event}`);

      if (session) {
        console.log('[LOGIN] User authenticated in auth change listener:', session.user.email);
        setUserEmail(session.user.email || null);
        router.push('/');
      } else {
        console.log('[LOGIN] User logged out or session expired');
      }
    });

    return () => {
      console.log('[LOGIN] Cleaning up auth state change listener');
      subscription.unsubscribe();
    };
  }, [router, supabase]);

  useEffect(() => {
    const videoElement = videoRef.current;
    if (!videoElement) return;

    const handleLoadedData = () => {
      setVideoLoaded(true);
    };

    const handleCanPlayThrough = () => {
      setCanAutoplay(true);
    };

    const handleAutoplayError = (event: ErrorEvent) => {
      setCanAutoplay(false);
      setError('Video autoplay prevented by browser settings');
    };

    videoElement.addEventListener('loadeddata', handleLoadedData);
    videoElement.addEventListener('canplaythrough', handleCanPlayThrough);
    videoElement.addEventListener('error', handleAutoplayError);

    return () => {
      videoElement.removeEventListener('loadeddata', handleLoadedData);
      videoElement.removeEventListener('canplaythrough', handleCanPlayThrough);
      videoElement.removeEventListener('error', handleAutoplayError);
    };
  }, []);

  return (
    <main className="flex flex-col items-center justify-center min-h-screen p-8 bg-[#1B2025] relative overflow-hidden">
      {/* Video Background */}
      <div className="video-background absolute inset-0 w-full h-full z-0">
        <video
          ref={videoRef}
          className="absolute inset-0 w-full h-full object-cover opacity-30"
          preload="auto"
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

      <div className="flex flex-col items-center relative z-10">
        <DynamicLogo
          className="h-96 w-auto mb-4"
          forceWhite={true}
        />

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
              onClick={handleGoogleLogin}
              disabled={isLoading}
              className="w-64 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white py-3 px-6 rounded-lg transition transform hover:scale-105 active:scale-95 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
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
