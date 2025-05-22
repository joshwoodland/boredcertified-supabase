import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { cookies } from 'next/headers';

// Helper to debug cookies
function debugCookies(cookieStore: ReturnType<typeof cookies>, prefix: string = 'DEBUG') {
  // Only log in development
  if (process.env.NODE_ENV !== 'development') return false;

  const allCookies = Array.from(cookieStore).map(([name]) => name);
  const authCookies = allCookies.filter(name => name.startsWith('sb-'));

  console.log(`[${prefix}] All cookies:`, allCookies);
  if (authCookies.length > 0) {
    console.log(`[${prefix}] Auth cookies found:`, authCookies.length);
    authCookies.forEach(name => console.log(`[${prefix}] Auth cookie: ${name}`));
  } else {
    console.log(`[${prefix}] No auth cookies found`);
  }

  return authCookies.length > 0;
}

// Helper function to clear all auth cookies
export function clearAuthCookies(response: NextResponse): NextResponse {
  const cookieStore = cookies();
  const allCookies = Array.from(cookieStore).map(([name]) => name);
  const authCookies = allCookies.filter(name => name.startsWith('sb-'));

  console.log(`[MIDDLEWARE] Clearing ${authCookies.length} auth cookies`);

  authCookies.forEach(name => {
    console.log(`[MIDDLEWARE] Forcibly removing auth cookie: ${name}`);
    response.cookies.set(name, '', {
      maxAge: 0,
      path: '/',
    });
  });

  return response;
}

export async function updateSession(request: NextRequest) {
  try {
    // Log the current path for debugging
    console.log(`[MIDDLEWARE] Processing request for: ${request.nextUrl.pathname}`);

    // Get cookie store for debugging and Supabase client
    const cookieStore = cookies(); // Synchronous in Next.js 14
    const hasAuthCookies = debugCookies(cookieStore, 'MIDDLEWARE');

    // Create an unmodified response
    const response = NextResponse.next({
      request: {
        headers: request.headers,
      },
    });

    // Check if Supabase environment variables are available
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      console.error(
        `[MIDDLEWARE] Missing Supabase environment variables: ${!supabaseUrl ? 'NEXT_PUBLIC_SUPABASE_URL' : ''} ${
          !supabaseAnonKey ? 'NEXT_PUBLIC_SUPABASE_ANON_KEY' : ''
        }`.trim()
      );
      throw new Error('Missing Supabase environment variables');
    }

    // Note: For middleware, we need to use createServerClient directly with cookie handlers
    // instead of the standard createClient() because middleware requires special cookie handling
    const supabase = createServerClient(
      supabaseUrl,
      supabaseAnonKey,
      {
        cookies: {
          get(name: string) {
            try {
              const cookie = cookieStore.get(name);
              if (process.env.NODE_ENV === 'development') {
                console.log(`[MIDDLEWARE] Reading cookie: ${name}, exists: ${!!cookie}`);
              }
              return cookie?.value;
            } catch (error) {
              console.error(`[MIDDLEWARE] Error getting cookie ${name}:`, error);
              return undefined;
            }
          },
          set(name: string, value: string, options: CookieOptions) {
            try {
              if (process.env.NODE_ENV === 'development') {
                console.log(`[MIDDLEWARE] Setting cookie: ${name}, options:`, options);
                if (value.startsWith('eyJ')) {
                  console.log(`[MIDDLEWARE] Setting JWT cookie: ${name}`);
                }
              }
              response.cookies.set(name, value, {
                ...options,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'lax',
                path: '/',
              });
            } catch (error) {
              console.error(`[MIDDLEWARE] Failed to set cookie ${name}:`, error);
            }
          },
          remove(name: string, options: CookieOptions) {
            try {
              if (process.env.NODE_ENV === 'development') {
                console.log(`[MIDDLEWARE] Removing cookie: ${name}`);
              }
              response.cookies.set(name, '', {
                ...options,
                maxAge: 0,
                path: '/',
              });
            } catch (error) {
              console.error(`[MIDDLEWARE] Failed to remove cookie ${name}:`, error);
            }
          },
        },
      }
    );

    // Refresh session if it exists
    console.log('[MIDDLEWARE] Attempting to get session');
    const { data, error } = await supabase.auth.getSession();

    if (error) {
      console.error('[MIDDLEWARE] Error getting session:', error);

      // Only clear cookies and redirect for specific token errors and not immediately after OAuth
      if (error.message?.includes('Invalid Refresh Token') || error.code === 'refresh_token_not_found') {
        // Don't aggressively clear cookies if we're coming from the auth callback
        const isFromAuthCallback = request.headers.get('referer')?.includes('/auth/callback');
        
        if (!isFromAuthCallback) {
          console.log('[MIDDLEWARE] Invalid refresh token detected (not from auth callback), clearing all auth cookies');

          // Find all auth cookies and remove them
          const allCookies = Array.from(cookieStore).map(([name]) => name);
          const authCookies = allCookies.filter(name => name.startsWith('sb-'));

          authCookies.forEach(name => {
            console.log(`[MIDDLEWARE] Forcibly removing invalid auth cookie: ${name}`);
            response.cookies.set(name, '', {
              maxAge: 0,
              path: '/',
            });
          });

          // Redirect to login page to force a clean login
          return NextResponse.redirect(new URL('/login', request.url));
        } else {
          console.log('[MIDDLEWARE] Token error from auth callback, allowing passthrough for session establishment');
          // Allow the request to pass through to give the session time to establish
          return response;
        }
      }

      // For other errors, don't redirect - let the client handle it
      console.log('[MIDDLEWARE] Non-token error, allowing request to continue');
      return response;
    }

    const session = data.session;

    if (session) {
      console.log('[MIDDLEWARE] Session found for user:', session.user.email);
    } else {
      console.log('[MIDDLEWARE] No session found');

      // If we have auth cookies but no session, try to refresh the session
      if (hasAuthCookies) {
        console.log('[MIDDLEWARE] Auth cookies present but no session, attempting refresh');
        try {
          const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();

          if (refreshError) {
            console.error('[MIDDLEWARE] Error refreshing session:', refreshError);

            // Only clear cookies and redirect for specific token errors and not immediately after OAuth
            if (refreshError.message?.includes('Invalid Refresh Token') ||
                refreshError.code === 'refresh_token_not_found') {
              
              // Don't aggressively clear cookies if we're coming from the auth callback
              const isFromAuthCallback = request.headers.get('referer')?.includes('/auth/callback');
              
              if (!isFromAuthCallback) {
                console.log('[MIDDLEWARE] Invalid refresh token during refresh (not from auth callback), clearing all auth cookies');

                // Find all auth cookies and remove them
                const allCookies = Array.from(cookieStore).map(([name]) => name);
                const authCookies = allCookies.filter(name => name.startsWith('sb-'));

                authCookies.forEach(name => {
                  console.log(`[MIDDLEWARE] Forcibly removing invalid auth cookie: ${name}`);
                  response.cookies.set(name, '', {
                    maxAge: 0,
                    path: '/',
                  });
                });

                // Redirect to login page to force a clean login
                return NextResponse.redirect(new URL('/login', request.url));
              } else {
                console.log('[MIDDLEWARE] Refresh error from auth callback, allowing passthrough for session establishment');
              }
            }
          } else if (refreshData.session) {
            console.log('[MIDDLEWARE] Session refreshed successfully for user:', refreshData.session.user.email);
          } else {
            console.log('[MIDDLEWARE] No session after refresh attempt');
          }
        } catch (refreshError) {
          console.error('[MIDDLEWARE] Exception during session refresh:', refreshError);
        }
      }
    }

    // Handle authentication for protected routes
    const isAuthRoute = request.nextUrl.pathname === '/login';
    const isProtectedRoute =
      !request.nextUrl.pathname.startsWith('/_next') &&
      !request.nextUrl.pathname.startsWith('/static') &&
      !isAuthRoute;

    // Don't redirect to login if we're coming from auth callback (give session time to establish)
    const isFromAuthCallback = request.headers.get('referer')?.includes('/auth/callback');

    if (isProtectedRoute && !session && !isFromAuthCallback) {
      console.log(`[MIDDLEWARE] Redirecting unauthenticated user to login from: ${request.nextUrl.pathname}`);
      return NextResponse.redirect(new URL('/login', request.url));
    }

    if (isAuthRoute && session) {
      console.log(`[MIDDLEWARE] Redirecting authenticated user to home from: ${request.nextUrl.pathname}`);
      return NextResponse.redirect(new URL('/', request.url));
    }

    // If we're in a potential race condition from auth callback, just let the request through
    if (isProtectedRoute && !session && isFromAuthCallback) {
      console.log(`[MIDDLEWARE] Allowing request from auth callback without session (race condition handling)`);
      return response;
    }

    // Check response cookies for debugging
    const responseCookies = response.cookies.getAll();
    if (process.env.NODE_ENV === 'development') {
      console.log('[MIDDLEWARE] Response cookies:', responseCookies.map(c => c.name));
    }

    return response;
  } catch (error) {
    // Log error and redirect to login for safety
    console.error('[MIDDLEWARE] Auth check error:', error);
    return NextResponse.redirect(new URL('/login', request.url));
  }
}
