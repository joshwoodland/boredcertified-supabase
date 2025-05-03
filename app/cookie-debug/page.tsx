'use client';

import { useState, useEffect } from 'react';
import { createBrowserClient } from '@supabase/ssr';

export default function CookieDebugPage() {
  const [cookies, setCookies] = useState<{name: string; value: string; rawValue: string}[]>([]);
  const [loginStatus, setLoginStatus] = useState<{email?: string, session: boolean, error?: string} | null>(null);
  const [updatingCookies, setUpdatingCookies] = useState(false);
  const [cookieDebug, setCookieDebug] = useState('');
  
  // Get all cookies on load
  useEffect(() => {
    const allCookies = document.cookie.split(';').map(cookie => {
      const [name, ...rest] = cookie.trim().split('=');
      const value = rest.join('=');
      
      // Try to decode and parse the cookie if it might be JSON
      let decodedValue = '';
      let rawValue = value;
      
      try {
        // First try normal decoding
        decodedValue = decodeURIComponent(value);
        
        // If it starts with base64, it might be base64 encoded
        if (decodedValue.startsWith('base64-')) {
          try {
            const base64Value = decodedValue.replace('base64-', '');
            const jsonStr = atob(base64Value);
            decodedValue = jsonStr;
          } catch (e) {
            console.error('Error decoding base64 cookie:', e);
          }
        }
      } catch (e) {
        console.error('Error decoding cookie:', e);
      }
      
      return { name, value: decodedValue, rawValue };
    });
    
    setCookies(allCookies);
    
    // Check current auth status
    checkAuthStatus();
  }, []);
  
  // Check auth status with Supabase
  const checkAuthStatus = async () => {
    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
      const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
      
      const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey);
      const { data, error } = await supabase.auth.getSession();
      
      if (error) {
        setLoginStatus({ session: false, error: error.message });
      } else {
        setLoginStatus({ 
          session: !!data.session, 
          email: data.session?.user?.email 
        });
      }
    } catch (error) {
      setLoginStatus({ 
        session: false, 
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };
  
  // Clear browser cookies
  const clearCookies = () => {
    setUpdatingCookies(true);
    
    const allCookies = document.cookie.split(';');
    
    for (let i = 0; i < allCookies.length; i++) {
      const cookie = allCookies[i];
      const eqPos = cookie.indexOf('=');
      const name = eqPos > -1 ? cookie.substring(0, eqPos).trim() : cookie.trim();
      document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
    }
    
    setTimeout(() => {
      window.location.reload();
    }, 1000);
  };
  
  // Extract auth-related cookies
  const authCookies = cookies.filter(cookie => 
    cookie.name.includes('supabase') || 
    cookie.name.includes('auth') || 
    cookie.name.includes('sb-')
  );
  
  return (
    <div className="p-8 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Cookie Debugging Page</h1>
      
      <div className="mb-8 bg-blue-50 p-4 rounded">
        <h2 className="text-xl font-semibold mb-2">Authentication Status</h2>
        {loginStatus ? (
          <div>
            {loginStatus.session ? (
              <div className="text-green-600">
                <p>✅ Logged in as: {loginStatus.email}</p>
              </div>
            ) : (
              <div className="text-red-600">
                <p>❌ Not logged in</p>
                {loginStatus.error && <p>Error: {loginStatus.error}</p>}
              </div>
            )}
          </div>
        ) : (
          <p>Checking login status...</p>
        )}
      </div>
      
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-2">Authentication Cookies</h2>
        {authCookies.length > 0 ? (
          <div className="overflow-auto">
            <table className="min-w-full bg-white border border-gray-300">
              <thead>
                <tr>
                  <th className="py-2 px-4 border-b text-left">Name</th>
                  <th className="py-2 px-4 border-b text-left">Raw Value</th>
                  <th className="py-2 px-4 border-b text-left">Decoded Value</th>
                </tr>
              </thead>
              <tbody>
                {authCookies.map((cookie, index) => (
                  <tr key={index} className={index % 2 === 0 ? 'bg-gray-50' : ''}>
                    <td className="py-2 px-4 border-b">{cookie.name}</td>
                    <td className="py-2 px-4 border-b font-mono text-xs break-all">
                      {cookie.rawValue.length > 50 
                        ? `${cookie.rawValue.substring(0, 50)}...` 
                        : cookie.rawValue}
                    </td>
                    <td className="py-2 px-4 border-b font-mono text-xs break-all">
                      {cookie.value.length > 50 
                        ? `${cookie.value.substring(0, 50)}...` 
                        : cookie.value}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p>No authentication cookies found.</p>
        )}
      </div>
      
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-2">All Cookies ({cookies.length})</h2>
        <div className="overflow-auto">
          <table className="min-w-full bg-white border border-gray-300">
            <thead>
              <tr>
                <th className="py-2 px-4 border-b text-left">Name</th>
                <th className="py-2 px-4 border-b text-left">Value</th>
              </tr>
            </thead>
            <tbody>
              {cookies.map((cookie, index) => (
                <tr key={index} className={index % 2 === 0 ? 'bg-gray-50' : ''}>
                  <td className="py-2 px-4 border-b">{cookie.name}</td>
                  <td className="py-2 px-4 border-b font-mono text-xs break-all">
                    {cookie.rawValue.length > 100 
                      ? `${cookie.rawValue.substring(0, 100)}...` 
                      : cookie.rawValue}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-2">Actions</h2>
        <div className="flex flex-wrap gap-4">
          <button
            onClick={clearCookies}
            disabled={updatingCookies}
            className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded disabled:bg-red-300"
            type="button"
          >
            {updatingCookies ? 'Clearing Cookies...' : 'Clear All Cookies & Reload'}
          </button>
          
          <button
            onClick={() => window.location.reload()}
            className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded"
            type="button"
          >
            Refresh Page
          </button>
        </div>
      </div>
      
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-2">Cookie Debugging</h2>
        <div className="mt-4">
          <textarea
            className="w-full h-32 border rounded p-2 font-mono"
            placeholder="Paste cookie value to debug here..."
            value={cookieDebug}
            onChange={(e) => setCookieDebug(e.target.value)}
          />
          <div className="mt-2">
            <button
              onClick={() => {
                try {
                  let result = cookieDebug;
                  // Try to decode the cookie if it's a base64 cookie
                  if (result.startsWith('base64-')) {
                    try {
                      const base64 = result.replace('base64-', '');
                      const decoded = atob(base64);
                      result = `Decoded base64:\n${decoded}`;
                    } catch (e) {
                      result = `Base64 decode error: ${e instanceof Error ? e.message : 'Unknown error'}`;
                    }
                  }
                  // Try to parse as JSON
                  else {
                    try {
                      const parsed = JSON.parse(result);
                      result = `Parsed JSON:\n${JSON.stringify(parsed, null, 2)}`;
                    } catch (e) {
                      result = `JSON parse error: ${e instanceof Error ? e.message : 'Unknown error'}`;
                    }
                  }
                  setCookieDebug(result);
                } catch (e) {
                  setCookieDebug(`Error: ${e instanceof Error ? e.message : 'Unknown error'}`);
                }
              }}
              className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded"
              type="button"
            >
              Decode/Parse Cookie
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
