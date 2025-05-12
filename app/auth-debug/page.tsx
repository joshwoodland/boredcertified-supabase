'use client';

import { useCallback, useEffect, useState } from 'react';
import { supabaseBrowser } from '@/app/lib/supabase';
import { createLogger } from '@/app/lib/supabase/logger';
import { useRouter } from 'next/navigation';
import type { AuthChangeEvent, Session } from '@supabase/supabase-js';

// Initialize logger for this component
const logger = createLogger('auth-debug');

export default function AuthDebugPage() {
  const [sessionData, setSessionData] = useState<Session | null>(null);
  const [cookiesData, setCookiesData] = useState<string[]>([]);
  const [authCookies, setAuthCookies] = useState<string[]>([]);
  const [refreshAttempted, setRefreshAttempted] = useState(false);
  const [refreshResult, setRefreshResult] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [adminData, setAdminData] = useState<Record<string, unknown> | null>(null);
  const [adminLoading, setAdminLoading] = useState(false);
  const [adminError, setAdminError] = useState<string | null>(null);
  const [adminAction, setAdminAction] = useState('');
  const [adminEmail, setAdminEmail] = useState('');

  const router = useRouter();

  /* ────────── helper utilities ────────── */
  const checkCookies = useCallback(() => {
    try {
      const allCookies = document.cookie.split(';').map(c => c.trim());
      setCookiesData(allCookies);
      const authCookiesFound = allCookies.filter(
        c => c.includes('-auth-token') || c.includes('sb-') || c.includes('supabase'),
      );
      setAuthCookies(authCookiesFound);
      return authCookiesFound.length > 0;
    } catch (e) {
      logger.error('Error checking cookies', e);
      setError(`Cookie check error: ${e instanceof Error ? e.message : String(e)}`);
      return false;
    }
  }, []);

  const attemptSessionRefresh = async () => {
    try {
      setRefreshAttempted(true);
      
      // Add null checking for Supabase client
      if (!supabaseBrowser) {
        const errorMsg = 'Supabase client not initialized';
        logger.error(errorMsg);
        setError(errorMsg);
        setRefreshResult({ error: new Error(errorMsg) });
        return null;
      }
      
      const { data, error } = await supabaseBrowser.auth.refreshSession();
      setRefreshResult({ data, error });
      
      if (error) {
        logger.error('Session refresh error', error);
        setError(`Session refresh error: ${error.message}`);
      }
      
      if (data.session) {
        setSessionData(data.session);
      }
      
      return data.session;
    } catch (e) {
      const errorMsg = `Refresh error: ${e instanceof Error ? e.message : String(e)}`;
      logger.error('Error refreshing session', e);
      setError(errorMsg);
      setRefreshResult({ error: e as unknown });
      return null;
    }
  };

  const forceLogout = async () => {
    try {
      // Add null checking for Supabase client
      if (!supabaseBrowser) {
        const errorMsg = 'Supabase client not initialized';
        logger.error(errorMsg);
        setError(errorMsg);
        return;
      }
      
      await supabaseBrowser.auth.signOut();
      setSessionData(null);
      router.refresh();
      logger.info('User successfully logged out');
    } catch (e) {
      const errorMsg = `Logout error: ${e instanceof Error ? e.message : String(e)}`;
      logger.error('Error during logout', e);
      setError(errorMsg);
    }
  };

  /* ────────── admin calls ────────── */
  const fetchAdminData = useCallback(async () => {
    try {
      setAdminLoading(true);
      setAdminError(null);
      logger.info('Fetching admin data');
      const response = await fetch('/api/auth-debug');
      if (!response.ok) throw new Error(`Server responded with ${response.status}`);
      const data = (await response.json()) as Record<string, unknown>;
      setAdminData(data);
      logger.info('Admin data fetched successfully');
    } catch (e) {
      const errorMsg = `Admin data fetch error: ${e instanceof Error ? e.message : String(e)}`;
      logger.error('Failed to fetch admin data', e);
      setAdminError(errorMsg);
    } finally {
      setAdminLoading(false);
    }
  }, []);

  const executeAdminAction = async () => {
    try {
      setAdminLoading(true);
      setAdminError(null);
      if (!adminAction) {
        setAdminError('Please select an action');
        return;
      }
      const payload: Record<string, unknown> = { action: adminAction };
      if (adminAction === 'verify_email' && adminEmail) payload.email = adminEmail;
      if (adminAction === 'delete_user' && sessionData?.user?.id) payload.userId = sessionData.user.id;

      const response = await fetch('/api/auth-fix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || `Server responded with ${response.status}`);
      alert(`Action completed: ${result.message}`);
      fetchAdminData();
    } catch (e) {
      setAdminError(`Admin action error: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setAdminLoading(false);
    }
  };

  /* ────────── initial & subscription logic ────────── */
  useEffect(() => {
    const checkSession = async () => {
      try {
        setLoading(true);
        const hasAuthCookies = checkCookies();
        logger.info('Auth cookies present', { hasAuthCookies });

        // Add null checking for Supabase client
        if (!supabaseBrowser) {
          const errorMsg = 'Supabase client not initialized';
          logger.error(errorMsg);
          setError(errorMsg);
          setLoading(false);
          return;
        }

        const { data: { session }, error } = await supabaseBrowser.auth.getSession();
        
        if (error) {
          logger.error('Session error', error);
          setError(`Session error: ${error.message}`);
        }
        
        setSessionData(session);

        if (hasAuthCookies && !session) {
          logger.warn('Cookie/session mismatch: Cookies present but no session');
        } else if (!hasAuthCookies && session) {
          logger.warn('Cookie/session mismatch: Session present but no cookies');
        }
      } catch (e) {
        const errorMsg = `Session check error: ${e instanceof Error ? e.message : String(e)}`;
        logger.error('Session check error', e);
        setError(errorMsg);
      } finally {
        setLoading(false);
      }
    };

    let subscription: { unsubscribe: () => void } | undefined;
    
    const setupAuthListener = () => {
      if (!supabaseBrowser) {
        logger.error('Cannot set up auth listener - Supabase client not initialized');
        return;
      }
      
      const { data } = supabaseBrowser.auth.onAuthStateChange(
        (event: AuthChangeEvent, session: Session | null) => {
          logger.info('Auth state changed', { event });
          setSessionData(session);
          checkCookies();
        }
      );
      
      subscription = data.subscription;
    };

    checkSession();
    setupAuthListener();

    return () => {
      if (subscription) subscription.unsubscribe();
    };
  }, [checkCookies]); // Include checkCookies in the dependency array

  useEffect(() => {
    if (sessionData) fetchAdminData();
  }, [sessionData, fetchAdminData]);

  /* ────────── render ────────── */
  return (
    <div className="container mx-auto p-4 max-w-4xl">
      Auth Debug Page UI goes here
      {/* add your UI elements / tables / buttons here */}
    </div>
  );
}
