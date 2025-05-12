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
                cookieStore.set(name, value, {
                  ...options,
                  // Ensure cookies are properly set with secure attributes
                  secure: process.env.NODE_ENV === 'production',
                  sameSite: 'lax',
                  path: '/'
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
                  maxAge: 0,
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
