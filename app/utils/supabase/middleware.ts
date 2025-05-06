import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

// Helper to debug cookie issues
function debugCookies(cookies: string[], prefix: string = 'DEBUG') {
  // Only log in development
  if (process.env.NODE_ENV !== 'development') return;
  
  const authCookies = cookies.filter(c => c.startsWith('sb-'));
  if (process.env.NODE_ENV === 'development' && authCookies.length > 0) {
    authCookies.forEach(cookie => {
      const [name, value] = cookie.split('=');
      const valuePreview = value.length > 20 ? `${value.substring(0, 20)}...` : value;
    });
  }
}

export async function updateSession(request: NextRequest) {
  try {
    // Create an unmodified response
    let response = NextResponse.next({
      request: {
        headers: request.headers,
      },
    });

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return request.cookies.get(name)?.value;
          },
          set(name: string, value: string, options: CookieOptions) {
            // Only log in development
            if (process.env.NODE_ENV === 'development') {
              if (value.startsWith('eyJ')) {
                // Base64 encoded JWT token detected
                debugCookies([`${name}=${value}`], 'MIDDLEWARE-COOKIE');
              }
            }
            response.cookies.set(name, value, options);
          },
          remove(name: string, options: CookieOptions) {
            response.cookies.set(name, '', options);
          },
        },
      }
    );

    // Refresh session if it exists
    const { data: { session } } = await supabase.auth.getSession();

    // Handle authentication for protected routes
    const isAuthRoute = request.nextUrl.pathname === '/login';
    const isProtectedRoute = !request.nextUrl.pathname.startsWith('/_next') && 
                           !request.nextUrl.pathname.startsWith('/static') &&
                           !isAuthRoute;

    if (isProtectedRoute && !session) {
      // Redirect unauthenticated users to login
      return NextResponse.redirect(new URL('/login', request.url));
    }

    if (isAuthRoute && session) {
      // Redirect authenticated users to home
      return NextResponse.redirect(new URL('/', request.url));
    }

    return response;
  } catch (error) {
    // Log error and redirect to login for safety
    if (process.env.NODE_ENV === 'development') {
      console.error('[MIDDLEWARE] Auth check error:', error);
    }
    return NextResponse.redirect(new URL('/login', request.url));
  }
} 