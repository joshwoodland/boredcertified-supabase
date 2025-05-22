import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/app/utils/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * This route is called by the Supabase Auth system after a user signs in with an OAuth provider.
 * It handles the callback from the OAuth provider and sets the session cookies.
 */
export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const origin = requestUrl.origin;

  console.log('[AUTH CALLBACK] Processing callback with origin:', origin);

  if (code) {
    try {
      const cookieStore = cookies();
      
      // Log all cookies for debugging
      const allCookies = cookieStore.getAll();
      console.log('[AUTH CALLBACK] Cookies before exchange:', allCookies.map(c => c.name));

      // Clear any existing auth cookies before setting new ones
      const authCookies = allCookies.filter(cookie => 
        cookie.name.includes('sb-') || 
        cookie.name.includes('-auth-token') ||
        cookie.name.includes('supabase')
      );

      console.log('[AUTH CALLBACK] Clearing existing auth cookies:', authCookies.map(c => c.name));
      
      // Remove all existing auth cookies
      authCookies.forEach(cookie => {
        cookieStore.delete(cookie.name);
        console.log(`[AUTH CALLBACK] Deleted cookie: ${cookie.name}`);
      });

      // Note: For OAuth callback, we need special cookie handling that the standard
      // client doesn't provide, so we use createServerClient directly
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      if (!supabaseUrl || !supabaseKey) {
        console.error('[AUTH CALLBACK] Missing Supabase environment variables');
        throw new Error('Missing Supabase environment variables');
      }

      const supabase = createServerClient(
        supabaseUrl,
        supabaseKey,
        {
          cookies: {
            get(name: string) {
              try {
                const cookie = cookieStore.get(name);
                console.log(`[AUTH CALLBACK] Reading cookie: ${name}, exists: ${!!cookie}`);
                return cookie?.value;
              } catch (error) {
                console.error(`[AUTH CALLBACK] Error getting cookie ${name}:`, error);
                return undefined;
              }
            },
            set(name: string, value: string, options: CookieOptions) {
              try {
                console.log(`[AUTH CALLBACK] Setting cookie: ${name}, options:`, options);
                // Always set new cookies with proper security attributes
                cookieStore.set(name, value, {
                  ...options,
                  secure: process.env.NODE_ENV === 'production',
                  sameSite: 'lax',
                  path: '/',
                  // Ensure cookies are properly scoped
                  domain: new URL(origin).hostname
                });
              } catch (error) {
                console.error(`[AUTH CALLBACK] Error setting cookie ${name}:`, error);
              }
            },
            remove(name: string, options: CookieOptions) {
              try {
                console.log(`[AUTH CALLBACK] Removing cookie: ${name}`);
                cookieStore.set(name, '', {
                  ...options,
                  maxAge: -1,
                  expires: new Date(0),
                  path: '/'
                });
              } catch (error) {
                console.error(`[AUTH CALLBACK] Error removing cookie ${name}:`, error);
              }
            },
          },
        }
      );

      // Exchange the code for a session
      const { data, error } = await supabase.auth.exchangeCodeForSession(code);

      if (error) {
        console.error('[AUTH CALLBACK] Error exchanging code for session:', error);
        throw error;
      }

      if (data.session) {
        console.log('[AUTH CALLBACK] Successfully created session for user:', data.session.user.email);

        // Verify the session was properly set
        const { data: sessionCheck } = await supabase.auth.getSession();
        if (sessionCheck.session) {
          console.log('[AUTH CALLBACK] Session verification successful');
          
          // Double check the user matches
          if (sessionCheck.session.user.id !== data.session.user.id) {
            console.warn('[AUTH CALLBACK] Session user mismatch - clearing cookies and retrying');
            // Clear all cookies again and retry the exchange
            authCookies.forEach(cookie => cookieStore.delete(cookie.name));
            const { data: retryData } = await supabase.auth.exchangeCodeForSession(code);
            console.log('[AUTH CALLBACK] Retry session created for:', retryData.session?.user.email);
          }
        } else {
          console.warn('[AUTH CALLBACK] Session verification failed - no session found after exchange');
        }
      } else {
        console.warn('[AUTH CALLBACK] No session data returned from exchange');
      }

      // Log all cookies after exchange
      const afterCookies = cookieStore.getAll();
      console.log('[AUTH CALLBACK] Cookies after exchange:', afterCookies.map(c => c.name));

    } catch (error) {
      console.error('[AUTH CALLBACK] Exception during auth callback:', error);
      // Continue to redirect even on error, to avoid leaving the user on an error page
    }
  } else {
    console.error('[AUTH CALLBACK] No code parameter found in callback URL');
  }

  // Create a response that redirects to the home page
  const response = NextResponse.redirect(new URL('/', request.url));

  // Log the response headers for debugging
  console.log('[AUTH CALLBACK] Redirect response created, redirecting to home page');

  return response;
}
