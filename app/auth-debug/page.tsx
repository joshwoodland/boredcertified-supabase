'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export default function AuthDebugPage() {
  const [clientSession, setClientSession] = useState<any>(null);
  const [cookies, setCookies] = useState<string[]>([]);
  const [localStorage, setLocalStorage] = useState<Record<string, string>>({});
  const [sessionStorage, setSessionStorage] = useState<Record<string, string>>({});
  const [envInfo, setEnvInfo] = useState<Record<string, string>>({});
  const [authCookieDetails, setAuthCookieDetails] = useState<any>(null);
  const [headers, setHeaders] = useState<Record<string, string>>({});
  const [authEventLog, setAuthEventLog] = useState<string[]>([]);
  const [jwtDecoded, setJwtDecoded] = useState<any>(null);
  const [refreshAttempted, setRefreshAttempted] = useState(false);
  const [loginStatus, setLoginStatus] = useState('Unknown');

  // Add a log entry with timestamp
  const addLog = (message: string) => {
    const timestamp = new Date().toISOString();
    setAuthEventLog(prev => [...prev, `${timestamp}: ${message}`]);
  };

  // Decode JWT
  const decodeJwt = (token: string) => {
    try {
      // JWT has three parts: header.payload.signature
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split('')
          .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      );
      return JSON.parse(jsonPayload);
    } catch (error) {
      console.error('Error decoding JWT', error);
      return { error: 'Failed to decode token' };
    }
  };

  // Monitor auth state changes
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        // Get client-side session
        const { data: { session } } = await supabase.auth.getSession();
        setClientSession(session);
        addLog(session ? 'Client session found' : 'No client session found');

        if (session?.access_token) {
          const decoded = decodeJwt(session.access_token);
          setJwtDecoded(decoded);
          addLog('JWT decoded successfully');
        }

        // Check login status
        setLoginStatus(session ? 'Logged In' : 'Not Logged In');
      } catch (error) {
        console.error('Error fetching initial data:', error);
        addLog(`Error fetching session: ${error}`);
      }
    };

    fetchInitialData();

    // Listen for auth changes
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      addLog(`Auth state changed: ${event}`);
      setClientSession(session);
      setLoginStatus(session ? 'Logged In' : 'Not Logged In');
      
      if (session?.access_token) {
        const decoded = decodeJwt(session.access_token);
        setJwtDecoded(decoded);
      }
    });

    // Fetch environment info
    setEnvInfo({
      'Node Environment': process.env.NODE_ENV || 'Not set',
      'Supabase URL Configured': process.env.NEXT_PUBLIC_SUPABASE_URL ? 'Yes' : 'No',
      'Anon Key Configured': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'Yes' : 'No'
    });

    // Get all cookies
    setCookies(document.cookie.split(';').map(cookie => cookie.trim()));

    // Find auth cookies specifically
    const authCookie = document.cookie
      .split(';')
      .map(cookie => cookie.trim())
      .find(cookie => cookie.includes('-auth-token'));
    
    if (authCookie) {
      const [name, value] = authCookie.split('=');
      setAuthCookieDetails({ name, exists: true });
      addLog(`Auth cookie found: ${name}`);
    } else {
      setAuthCookieDetails({ exists: false });
      addLog('No auth cookie found');
    }

    // Get local storage items
    const localStorageItems: Record<string, string> = {};
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (key) {
        const value = window.localStorage.getItem(key) || '';
        if (key.includes('supabase') || key.includes('auth')) {
          localStorageItems[key] = value.substring(0, 50) + (value.length > 50 ? '...' : '');
        }
      }
    }
    setLocalStorage(localStorageItems);

    // Get session storage items
    const sessionStorageItems: Record<string, string> = {};
    for (let i = 0; i < window.sessionStorage.length; i++) {
      const key = window.sessionStorage.key(i);
      if (key) {
        const value = window.sessionStorage.getItem(key) || '';
        if (key.includes('supabase') || key.includes('auth')) {
          sessionStorageItems[key] = value.substring(0, 50) + (value.length > 50 ? '...' : '');
        }
      }
    }
    setSessionStorage(sessionStorageItems);

    // Get request headers using a fetch to our own API
    fetch('/api/auth-debug-headers')
      .then(response => response.json())
      .then(data => {
        setHeaders(data.headers);
        addLog('Retrieved request headers');
      })
      .catch(error => {
        console.error('Error fetching headers:', error);
        addLog(`Error fetching headers: ${error}`);
      });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  // Handle manual token refresh
  const handleRefreshToken = async () => {
    try {
      addLog('Attempting to refresh token...');
      setRefreshAttempted(true);
      const { data, error } = await supabase.auth.refreshSession();
      
      if (error) {
        addLog(`Token refresh error: ${error.message}`);
        return;
      }
      
      addLog('Token refreshed successfully');
      setClientSession(data.session);
      
      if (data.session?.access_token) {
        const decoded = decodeJwt(data.session.access_token);
        setJwtDecoded(decoded);
      }
    } catch (error) {
      console.error('Error refreshing token:', error);
      addLog(`Error in refresh: ${error}`);
    }
  };

  // Handle login with Google
  const handleLogin = async () => {
    try {
      addLog('Initiating login with Google...');
      const redirectUrl = `${window.location.protocol}//${window.location.hostname}:${window.location.port}`;
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl,
        },
      });
      
      if (error) {
        addLog(`Login error: ${error.message}`);
      }
    } catch (error) {
      console.error('Login error:', error);
      addLog(`Login error: ${error}`);
    }
  };

  // Handle logout
  const handleLogout = async () => {
    try {
      addLog('Logging out...');
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        addLog(`Logout error: ${error.message}`);
        return;
      }
      
      addLog('Logged out successfully');
      setClientSession(null);
      setJwtDecoded(null);
      setLoginStatus('Not Logged In');
      
      // Refresh page to update cookies
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (error) {
      console.error('Logout error:', error);
      addLog(`Logout error: ${error}`);
    }
  };

  // Section component for better organization
  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div className="mb-6">
      <h2 className="text-lg font-bold mb-2 border-b pb-1">{title}</h2>
      <div className="pl-2">{children}</div>
    </div>
  );

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <h1 className="text-2xl font-bold mb-6">Supabase Auth Debug Page</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-6">
          <div className="bg-blue-100 p-4 rounded-lg">
            <h2 className="text-xl font-bold">Current Auth Status</h2>
            <p className="text-lg mt-2">
              {loginStatus === 'Logged In' ? (
                <span className="text-green-600 font-semibold">✅ Logged In</span>
              ) : (
                <span className="text-red-600 font-semibold">❌ Not Logged In</span>
              )}
            </p>
            <div className="mt-4 space-x-2">
              {loginStatus !== 'Logged In' ? (
                <button 
                  onClick={handleLogin}
                  className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
                >
                  Login with Google
                </button>
              ) : (
                <button 
                  onClick={handleLogout}
                  className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600"
                >
                  Logout
                </button>
              )}
              <button 
                onClick={handleRefreshToken}
                className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
              >
                Refresh Token
              </button>
              {refreshAttempted && (
                <span className="ml-2 italic">
                  {clientSession ? "✅ Token refreshed" : "❌ Refresh failed"}
                </span>
              )}
            </div>
          </div>

          <Section title="Cookie Information">
            <div className="bg-yellow-100 p-2 rounded mb-2">
              <strong>Auth Cookie Status:</strong>{' '}
              {authCookieDetails?.exists ? (
                <span className="text-green-600">Found ({authCookieDetails.name})</span>
              ) : (
                <span className="text-red-600">Not Found</span>
              )}
            </div>
            <div className="max-h-40 overflow-y-auto text-sm">
              <table className="w-full">
                <thead>
                  <tr>
                    <th className="text-left">Cookie</th>
                  </tr>
                </thead>
                <tbody>
                  {cookies.length === 0 ? (
                    <tr><td className="italic">No cookies found</td></tr>
                  ) : (
                    cookies.map((cookie, i) => (
                      <tr key={i} className={cookie.includes('-auth-') ? 'font-bold bg-yellow-50' : ''}>
                        <td>{cookie}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Section>

          <Section title="Session State">
            <div className="overflow-x-auto">
              <pre className="text-xs bg-gray-100 p-2 rounded max-h-48 overflow-y-auto">
                {JSON.stringify(clientSession, null, 2) || "No session data"}
              </pre>
            </div>
          </Section>
          
          <Section title="JWT Token (Decoded)">
            <div className="overflow-x-auto">
              <pre className="text-xs bg-gray-100 p-2 rounded max-h-48 overflow-y-auto">
                {jwtDecoded ? JSON.stringify(jwtDecoded, null, 2) : "No JWT token available"}
              </pre>
            </div>
          </Section>
        </div>

        <div className="space-y-6">
          <Section title="Local Storage (Auth-related)">
            <div className="max-h-40 overflow-y-auto text-sm">
              <table className="w-full">
                <thead>
                  <tr>
                    <th className="text-left">Key</th>
                    <th className="text-left">Value</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.keys(localStorage).length === 0 ? (
                    <tr><td colSpan={2} className="italic">No auth-related items in localStorage</td></tr>
                  ) : (
                    Object.entries(localStorage).map(([key, value], i) => (
                      <tr key={i}>
                        <td className="pr-2 align-top">{key}</td>
                        <td className="text-xs break-all">{value}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Section>

          <Section title="Session Storage (Auth-related)">
            <div className="max-h-40 overflow-y-auto text-sm">
              <table className="w-full">
                <thead>
                  <tr>
                    <th className="text-left">Key</th>
                    <th className="text-left">Value</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.keys(sessionStorage).length === 0 ? (
                    <tr><td colSpan={2} className="italic">No auth-related items in sessionStorage</td></tr>
                  ) : (
                    Object.entries(sessionStorage).map(([key, value], i) => (
                      <tr key={i}>
                        <td className="pr-2 align-top">{key}</td>
                        <td className="text-xs break-all">{value}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Section>

          <Section title="Environment Information">
            <table className="w-full text-sm">
              <tbody>
                {Object.entries(envInfo).map(([key, value], i) => (
                  <tr key={i}>
                    <td className="pr-2 font-medium">{key}:</td>
                    <td>{value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>

          <Section title="Auth Event Log">
            <div className="max-h-40 overflow-y-auto text-xs">
              <pre className="bg-gray-100 p-2 rounded whitespace-pre-wrap">
                {authEventLog.length === 0 ? (
                  "No events logged yet"
                ) : (
                  authEventLog.map((log, i) => (
                    <div key={i}>{log}</div>
                  ))
                )}
              </pre>
            </div>
          </Section>

          <Section title="Request Headers">
            <div className="max-h-40 overflow-y-auto text-sm">
              <table className="w-full">
                <thead>
                  <tr>
                    <th className="text-left">Header</th>
                    <th className="text-left">Value</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.keys(headers).length === 0 ? (
                    <tr><td colSpan={2} className="italic">No headers available</td></tr>
                  ) : (
                    Object.entries(headers).map(([key, value], i) => (
                      <tr key={i}>
                        <td className="pr-2">{key}</td>
                        <td>{value}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Section>
        </div>
      </div>

      <div className="mt-6 border-t pt-4">
        <h2 className="text-lg font-bold mb-4">Troubleshooting Instructions</h2>
        <ol className="list-decimal pl-5 space-y-2">
          <li>Check if the Auth Cookie exists - this is required for server-side authentication</li>
          <li>Verify that the JWT token has not expired (check the "exp" value in decoded JWT)</li>
          <li>Ensure the environment variables are correctly configured</li>
          <li>Try logging out and logging back in to refresh all auth state</li>
          <li>Check for differences between client session state and cookie existence</li>
          <li>Use the Refresh Token button to test token refresh functionality</li>
          <li>Look for error messages in the Auth Event Log</li>
        </ol>
      </div>
    </div>
  );
}
