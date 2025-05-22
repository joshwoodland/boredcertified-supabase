/**
 * @file app/api/clear-auth-cookies/route.ts
 * @description API route to clear all Supabase authentication cookies
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

/**
 * GET handler to clear all Supabase auth cookies
 */
export async function GET(request: NextRequest) {
  try {
    console.log('[CLEAR-AUTH-COOKIES] Clearing all Supabase auth cookies');
    
    // Get all cookies
    const cookieStore = cookies();
    const allCookies = Array.from(cookieStore.getAll());
    
    // Find auth cookies (they start with 'sb-')
    const authCookies = allCookies.filter(cookie => cookie.name.startsWith('sb-'));
    
    console.log(`[CLEAR-AUTH-COOKIES] Found ${authCookies.length} auth cookies to clear`);
    
    // Create response with redirect to login
    const response = NextResponse.redirect(new URL('/login', request.url));
    
    // Delete each auth cookie
    authCookies.forEach(cookie => {
      console.log(`[CLEAR-AUTH-COOKIES] Removing cookie: ${cookie.name}`);
      response.cookies.delete(cookie.name);
    });
    
    return response;
  } catch (error) {
    console.error('[CLEAR-AUTH-COOKIES] Error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to clear auth cookies',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
