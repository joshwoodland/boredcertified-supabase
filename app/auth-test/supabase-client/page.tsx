'use client';

import { useState, useEffect } from 'react';
import { createBrowserClient } from '@supabase/ssr';

// Define the shape of our auth test response
interface AuthTestResponse {
  authenticated?: boolean;
  userId?: string;
  userEmail?: string;
  cookiesPresent?: number;
  authCookieNames?: string[];
  message?: string;
  error?: string;
  details?: string;
  cookiePresent?: boolean;
  authCookiePresent?: boolean;
}

export default function SupabaseClientTest() {
  const [authResult, setAuthResult] = useState<AuthTestResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [clientAuthStatus, setClientAuthStatus] = useState<{ session: any; clientSide: boolean } | null>(null);

  // Function to test server-side auth
  const testServerAuth = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/auth-test/supabase-client');
      const data = await response.json();
      setAuthResult(data);
    } catch (error) {
      setAuthResult({
        error: 'Failed to test auth',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setLoading(false);
    }
  };

  // Check client-side auth on component mount
  useEffect(() => {
    const checkClientAuth = async () => {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
      const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

      const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey);
      const { data } = await supabase.auth.getSession();
      
      setClientAuthStatus({
        session: data.session,
        clientSide: true
      });
    };

    checkClientAuth();
  }, []);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Supabase Authentication Test</h1>
      
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-2">1. Client-Side Auth Status</h2>
        {clientAuthStatus ? (
          <div className="bg-gray-100 p-4 rounded">
            <p className="font-semibold">
              Client-side authenticated: {clientAuthStatus.session ? 'Yes ✅' : 'No ❌'}
            </p>
            {clientAuthStatus.session && (
              <div className="mt-2">
                <p>User ID: {clientAuthStatus.session.user.id}</p>
                <p>Email: {clientAuthStatus.session.user.email}</p>
              </div>
            )}
          </div>
        ) : (
          <p>Checking client-side auth status...</p>
        )}
      </div>

      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-2">2. Server-Side Auth Test</h2>
        <p className="mb-4">
          This test verifies if the server can access your authentication session via cookies.
          This is crucial for API routes to correctly identify you.
        </p>
        
        <button
          onClick={testServerAuth}
          disabled={loading}
          className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded disabled:bg-blue-300"
          type="button"
        >
          {loading ? 'Testing...' : 'Test Server Auth'}
        </button>

        {authResult && (
          <div className="mt-4 bg-gray-100 p-4 rounded">
            {authResult.authenticated ? (
              <>
                <p className="text-green-600 font-bold">✅ Server authenticated you successfully!</p>
                <div className="mt-2">
                  <p>User ID: {authResult.userId}</p>
                  <p>Email: {authResult.userEmail}</p>
                  <p>Cookies present: {authResult.cookiesPresent}</p>
                  <p>Auth cookies: {authResult.authCookieNames?.join(', ') || 'None'}</p>
                </div>
              </>
            ) : (
              <>
                <p className="text-red-600 font-bold">❌ Server could not authenticate you</p>
                <div className="mt-2">
                  {authResult.message && <p>Message: {authResult.message}</p>}
                  {authResult.error && <p>Error: {authResult.error}</p>}
                  {authResult.details && <p>Details: {authResult.details}</p>}
                  <p>Cookies present: {authResult.cookiesPresent ? 'Yes' : 'No'}</p>
                  <p>Auth cookie present: {authResult.authCookiePresent ? 'Yes' : 'No'}</p>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      <div className="mt-8 p-4 bg-yellow-50 rounded border border-yellow-200">
        <h3 className="font-semibold mb-2">Authentication Troubleshooting</h3>
        <ul className="list-disc ml-6 space-y-1">
          <li>If client-side auth works but server-side fails, your cookie handling is broken</li>
          <li>Check that your middleware is allowing API routes to pass through</li>
          <li>Ensure that you're using the correct Supabase client instances</li>
          <li>Cookie management between client and server requires consistent configuration</li>
        </ul>
      </div>
    </div>
  );
}
