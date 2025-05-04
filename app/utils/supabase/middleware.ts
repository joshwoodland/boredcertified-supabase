import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

// Simple debug function to help troubleshoot cookie issues
const debugCookies = (request: NextRequest, prefix: string) => {
  if (process.env.NODE_ENV === 'development') {
    const cookies = request.cookies.getAll();
    console.log(`[${prefix}] Found ${cookies.length} cookies`);
    
    // Look specifically for auth cookies
    const authCookies = cookies.filter(c => c.name.includes('-auth-token'));
    console.log(`[${prefix}] Auth cookies: ${authCookies.map(c => c.name).join(', ')}`);
    
    // Log the first few characters of each auth cookie
    authCookies.forEach(cookie => {
      const valuePreview = cookie.value.substring(0, 30) + '...';
      console.log(`[${prefix}] ${cookie.name}: ${valuePreview}`);
    });
  }
};

export async function updateSession(request: NextRequest) {
  // Debug cookies before any processing
  debugCookies(request, 'MIDDLEWARE-START');

  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          // Get all cookies from the request
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          // When setting cookies, set them in both the request and response
          cookiesToSet.forEach(({ name, value, options }) => {
            // For auth token cookies, log the type (to help debug base64 issues)
            if (name.includes('-auth-token') && process.env.NODE_ENV === 'development') {
              console.log(`[MIDDLEWARE-COOKIE] Setting cookie ${name}: ${value.substring(0, 10)}...`);
              if (value.startsWith('base64-')) {
                console.log(`[MIDDLEWARE-COOKIE] Detected base64-encoded cookie`);
              }
            }
            
            request.cookies.set(name, value);
          });
          
          // Create a new response with the updated request
          supabaseResponse = NextResponse.next({
            request,
          });
          
          // Also set cookies in the response
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // IMPORTANT: Avoid writing any logic between createServerClient and
  // supabase.auth.getUser(). A simple mistake could make it very hard to debug
  // issues with users being randomly logged out.

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
  
    // Debug cookies after auth check
    debugCookies(request, 'MIDDLEWARE-AFTER-AUTH');
  
    if (
      !user &&
      !request.nextUrl.pathname.startsWith('/login') &&
      !request.nextUrl.pathname.startsWith('/auth') &&
      !request.nextUrl.pathname.startsWith('/api')) {
      // no user, potentially respond by redirecting the user to the login page
      console.log(`[MIDDLEWARE] No authenticated user, redirecting to login from: ${request.nextUrl.pathname}`);
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      return NextResponse.redirect(url);
    }

    // If user exists and trying to access login page, redirect to home
    if (user && request.nextUrl.pathname === '/login') {
      console.log(`[MIDDLEWARE] User already logged in, redirecting to home`);
      const url = request.nextUrl.clone();
      url.pathname = '/';
      return NextResponse.redirect(url);
    }

    return supabaseResponse;
  } catch (error) {
    // Log any errors that occur during auth check
    console.error('[MIDDLEWARE] Error checking authentication:', error);
    
    // On error for non-login paths, redirect to login (safety fallback)
    if (!request.nextUrl.pathname.startsWith('/login') && 
        !request.nextUrl.pathname.startsWith('/auth') &&
        !request.nextUrl.pathname.startsWith('/api')) {
      console.log(`[MIDDLEWARE] Error in auth check, redirecting to login for safety`);
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      return NextResponse.redirect(url);
    }
    
    return supabaseResponse;
  }
} 