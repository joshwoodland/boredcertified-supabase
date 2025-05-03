import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  // Get the pathname of the request
  const path = request.nextUrl.pathname;
  
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
    '/auth-debug'  // Make our new debug page accessible without auth
  ].some(publicPath => path.startsWith(publicPath));
  
  // If it's a public route, don't check authentication
  if (isPublicRoute) {
    console.log(`Allowing access to public route: ${path}`);
    return NextResponse.next();
  }
  
  // DEVELOPMENT BYPASS: Skip auth check in development mode only if explicitly enabled
  const bypassAuth = isDevelopment && process.env.NEXT_PUBLIC_DEV_AUTH_BYPASS === 'true';
  if (bypassAuth) {
    console.log(`DEVELOPMENT MODE: Bypassing auth check for ${path}`);
    return NextResponse.next();
  }

  // PRODUCTION: Check for Supabase auth cookie
  console.log(`Checking auth for path: ${path}`);
  
  // Get all cookies for debugging
  const allCookies = request.cookies.getAll();
  console.log('All cookies:', allCookies.map(c => c.name));
  
  // Check for Supabase auth cookie
  // The cookie name is in the format "sb-{projectRef}-auth-token"
  const hasAuthCookie = allCookies.some(cookie => cookie.name.includes('-auth-token'));
  console.log(`Auth cookie found: ${hasAuthCookie}`);

  // If no auth cookie and trying to access a protected route, redirect to login
  if (!hasAuthCookie && path !== '/login') {
    console.log('No session detected, redirecting to login');
    const url = new URL('/login', request.url);
    return NextResponse.redirect(url);
  }

  // If auth cookie exists and user is at login page, redirect to home
  if (hasAuthCookie && path === '/login') {
    console.log('Session detected at login page, redirecting to home');
    const url = new URL('/', request.url);
    return NextResponse.redirect(url);
  }

  // Continue with the request - allowing logged-in users to access protected routes
  return NextResponse.next();
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
