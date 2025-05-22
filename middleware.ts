import { type NextRequest } from 'next/server';
import { updateSession } from '@/app/utils/supabase/middleware';

export async function middleware(request: NextRequest) {
  // Skip auth check for Deepgram endpoints and diagnostic pages
  const pathname = request.nextUrl.pathname.toLowerCase();

  // Special route to clear all auth cookies is now handled by the API route
  // /api/clear-auth-cookies/route.ts

  // Allow Deepgram API endpoints
  if (pathname === '/api/deepgram/websocket' ||
      pathname.startsWith('/api/deepgram/websocket/') ||
      pathname === '/api/deepgram/token' ||
      pathname === '/api/deepgram/token-test') {
    return;
  }

  // Allow diagnostic endpoints and pages
  if (pathname === '/debug/deepgram' ||
      pathname === '/debug/deepgram-token' ||
      pathname === '/debug/deepgram-debug' ||
      pathname === '/api/debug-env' ||
      pathname === '/api/test-deepgram-key' ||
      pathname === '/api/deepgram-direct-test' ||
      pathname === '/api/env-test' ||
      pathname === '/api/debug-page' ||
      pathname === '/api/direct-key-test') {
    return;
  }

  // Allow auth callback route and immediate post-auth requests
  if (pathname === '/auth/callback') {
    return;
  }

  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - Public assets like images, videos, and other media
     * - /api/auth-test (our test endpoint)
     * - /auth/callback (auth callback route)
     * - /api/clear-auth-cookies (special route to clear auth cookies)
     * - /api/deepgram/websocket (Deepgram WebSocket endpoint)
     * - /debug/deepgram (diagnostic page)
     * - /debug/deepgram-debug (comprehensive diagnostic page)
     * - /api/debug-env (diagnostic API)
     * - /api/test-deepgram-key (diagnostic API)
     * - /api/deepgram-direct-test (direct test API)
     * - /api/env-test (simple env test API)
     * - /api/debug-page (HTML debug page)
     * - /api/direct-key-test (direct API key test)
     */
    '/((?!_next/static|_next/image|favicon.ico|api/auth-test|auth/callback|api/clear-auth-cookies|api/deepgram/websocket|api/deepgram/token|api/deepgram/token-test|debug/deepgram|debug/deepgram-token|debug/deepgram-debug|api/debug-env|api/test-deepgram-key|api/deepgram-direct-test|api/env-test|api/debug-page|api/direct-key-test|background.mp4|video-poster.png|logo.png|.*\\.(?:svg|png|jpg|jpeg|gif|webp|mp4|webm)$).*)',
  ],
};
