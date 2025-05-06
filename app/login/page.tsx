'use client';

import { useEffect, useState, useRef } from 'react';
import { createClient } from '@/app/utils/supabase/client';
import { loginWithGoogle } from './actions';
import DynamicLogo from '../components/DynamicLogo';
import { useRouter } from 'next/navigation';
import { Session } from '@supabase/supabase-js';

export default function LoginPage() {
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [videoLoaded, setVideoLoaded] = useState(false);
  const [canAutoplay, setCanAutoplay] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const supabase = createClient();
  const router = useRouter();

  const handleGoogleLogin = async () => {
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      });

      if (error) throw error;
      
      // Redirect to OAuth provider URL
      if (data?.url) {
        window.location.href = data.url;
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to login with Google');
    }
  };

  useEffect(() => {
    const checkSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session) {
          router.push('/');
        }
      } catch (error) {
        setError(error instanceof Error ? error.message : 'Failed to check session');
      }
    };

    checkSession();
  }, [router]);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event: string, session: Session | null) => {
      if (session) {
        router.push('/');
      }
    });

    return () => subscription.unsubscribe();
  }, [router]);

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
