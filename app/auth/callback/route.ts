import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

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
  console.log('[AUTH CALLBACK] Authorization code received:', code ? `${code.substring(0, 10)}...` : 'NO CODE');

  if (code) {
    try {
      const cookieStore = cookies();

      // Log existing cookies for debugging - but don't clear them yet
      const allCookies = cookieStore.getAll();
      console.log('[AUTH CALLBACK] Existing cookies:', allCookies.map(c => c.name));

      // Check if Supabase environment variables are available
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      if (!supabaseUrl || !supabaseKey) {
        console.error('[AUTH CALLBACK] Missing Supabase environment variables');
        throw new Error('Missing Supabase environment variables');
      }

      // Create Supabase client with proper cookie handling for PKCE
      const supabase = createServerClient(
        supabaseUrl,
        supabaseKey,
        {
          cookies: {
            get(name: string) {
              const cookie = cookieStore.get(name);
              return cookie?.value;
            },
            set(name: string, value: string, options: CookieOptions) {
              try {
                cookieStore.set(name, value, {
                  ...options,
                  secure: process.env.NODE_ENV === 'production',
                  sameSite: 'lax',
                  path: '/',
                });
              } catch (error) {
                console.error(`[AUTH CALLBACK] Error setting cookie ${name}:`, error);
              }
            },
            remove(name: string, options: CookieOptions) {
              try {
                cookieStore.set(name, '', {
                  ...options,
                  maxAge: 0,
                  path: '/',
                });
              } catch (error) {
                console.error(`[AUTH CALLBACK] Error removing cookie ${name}:`, error);
              }
            },
          },
        }
      );

      // Exchange the code for a session - this should handle PKCE automatically
      console.log('[AUTH CALLBACK] Exchanging authorization code for session...');
      const { data, error } = await supabase.auth.exchangeCodeForSession(code);

      if (error) {
        console.error('[AUTH CALLBACK] Error exchanging code for session:', {
          message: error.message,
          status: error.status,
          code: error.code
        });
        
        // Log additional debug info for PKCE errors
        if (error.message?.includes('code verifier') || error.code === 'validation_failed') {
          console.error('[AUTH CALLBACK] PKCE validation error detected');
          const pkceRelatedCookies = allCookies.filter(c => 
            c.name.includes('pkce') || 
            c.name.includes('verifier') || 
            c.name.includes('code_verifier') ||
            c.name.startsWith('sb-')
          );
          console.error('[AUTH CALLBACK] Auth-related cookies:', pkceRelatedCookies.map(c => c.name));
        }
        
        throw error;
      }

      if (data.session) {
        console.log('[AUTH CALLBACK] Successfully created session for user:', data.session.user.email);

        // Verify the session was properly set
        const { data: sessionCheck } = await supabase.auth.getSession();
        if (sessionCheck.session) {
          console.log('[AUTH CALLBACK] Session verification successful');
        } else {
          console.warn('[AUTH CALLBACK] Session verification failed');
        }
      } else {
        console.warn('[AUTH CALLBACK] No session data returned from exchange');
      }

    } catch (error) {
      console.error('[AUTH CALLBACK] Exception during auth callback:', error);
      // Continue to redirect even on error, but redirect to login with error
      const errorResponse = NextResponse.redirect(new URL('/login?error=callback_error', origin));
      return errorResponse;
    }
  } else {
    console.error('[AUTH CALLBACK] No authorization code found in callback URL');
    return NextResponse.redirect(new URL('/login?error=no_code', origin));
  }

  // Create redirect response to home page
  const response = NextResponse.redirect(new URL('/', origin));

  // Add cache control headers
  response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
  response.headers.set('Pragma', 'no-cache');
  response.headers.set('Expires', '0');

  console.log('[AUTH CALLBACK] Redirecting to home page');
  return response;
}
