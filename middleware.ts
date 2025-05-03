import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs';

export async function middleware(request: NextRequest) {
  // Get the pathname of the request
  const path = request.nextUrl.pathname;
  
  // Create response object for middleware
  const response = NextResponse.next();
  
  // Create a Supabase client specifically for middleware
  const supabase = createMiddlewareClient({ 
    req: request, 
    res: response
  });
  
  // Check if we're in development mode
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  // Define public routes that don't need authentication
  const isPublicRoute = [
    '/login',
    '/_next',
    '/api',
    '/favicon.ico',
    '/logo.png',
    '/uploads',
    '/auth-debug',
    '/cookie-debug'  // Make all debug pages accessible without auth
  ].some(publicPath => path.startsWith(publicPath));
  
  // If it's a public route, don't check authentication
  if (isPublicRoute) {
    console.log(`Allowing access to public route: ${path}`);
    return response;
  }
  
  // DEVELOPMENT BYPASS: Skip auth check in development mode only if explicitly enabled
  const bypassAuth = isDevelopment && process.env.NEXT_PUBLIC_DEV_AUTH_BYPASS === 'true';
  if (bypassAuth) {
    console.log(`DEVELOPMENT MODE: Bypassing auth check for ${path}`);
    return response;
  }

  // Check session with our Supabase middleware client
  try {
    // This will refresh the session if needed and set the correct cookies
    const { data: { session } } = await supabase.auth.getSession();
    
    console.log(`Checking auth for path: ${path}, session found: ${!!session}`);
    
    // If no session and trying to access a protected route, redirect to login
    if (!session && path !== '/login') {
      console.log('No session detected, redirecting to login');
      const url = new URL('/login', request.url);
      return NextResponse.redirect(url);
    }

    // If session exists and user is at login page, redirect to home
    if (session && path === '/login') {
      console.log('Session detected at login page, redirecting to home');
      const url = new URL('/', request.url);
      return NextResponse.redirect(url);
    }
  } catch (error) {
    console.error('Error checking auth session:', error);
    // On error, we'll redirect to login for protected routes as a fallback
    if (path !== '/login') {
      const url = new URL('/login', request.url);
      return NextResponse.redirect(url);
    }
  }
  
  return response;
}

export const config = {
  matcher: [
    // Match all request paths except for the ones starting with:
    // - api (API routes)
    // - _next/static (static files)
    // - _next/image (image optimization files)
    // - favicon.ico (favicon file)
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
