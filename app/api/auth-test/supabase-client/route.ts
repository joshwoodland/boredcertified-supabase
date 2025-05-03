import { NextRequest, NextResponse } from 'next/server';
import { createServerComponentSupabaseClient } from '@/app/lib/server-supabase';
import { cookies } from 'next/headers';

export async function GET(request: NextRequest) {
  try {
    // Create a Supabase client using the cookies from the request
    const cookieStore = cookies();
    const supabaseServer = createServerComponentSupabaseClient(() => cookieStore);
    
    // Get current user session with server-side auth
    const { data: { session }, error } = await supabaseServer.auth.getSession();
    
    if (error) {
      console.error('Error getting session:', error);
      return NextResponse.json({ 
        error: 'Failed to get session',
        details: error.message 
      }, { status: 500 });
    }
    
    if (!session) {
      return NextResponse.json({ 
        authenticated: false,
        message: 'No active session found',
        cookiesPresent: cookieStore.getAll().length > 0,
        authCookiePresent: cookieStore.getAll().some(c => c.name.includes('-auth-token'))
      }, { status: 401 });
    }
    
    // Return user information if authenticated
    return NextResponse.json({
      authenticated: true,
      userId: session.user.id,
      userEmail: session.user.email,
      cookiesPresent: cookieStore.getAll().length,
      authCookieNames: cookieStore.getAll()
        .filter(c => c.name.includes('-auth-'))
        .map(c => c.name)
    });
    
  } catch (error) {
    console.error('Authentication test error:', error);
    return NextResponse.json({ 
      error: 'Authentication test failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
