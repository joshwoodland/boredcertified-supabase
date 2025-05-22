import { type NextRequest } from 'next/server';
import { updateSession } from '@/app/utils/supabase/middleware';

export async function middleware(request: NextRequest) {
  // Skip auth check for Deepgram endpoints
  const pathname = request.nextUrl.pathname.toLowerCase();
  if (pathname === '/api/deepgram/websocket' || pathname.startsWith('/api/deepgram/websocket/')) {
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
     * - /api/deepgram/websocket (Deepgram WebSocket endpoint)
     */
    '/((?!_next/static|_next/image|favicon.ico|api/auth-test|auth/callback|api/deepgram/websocket|background.mp4|video-poster.png|logo.png|.*\\.(?:svg|png|jpg|jpeg|gif|webp|mp4|webm)$).*)',
  ],
};
