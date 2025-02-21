import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// We'll handle file serving through a static middleware in next.config.js instead
export function middleware(request: NextRequest) {
  return NextResponse.next()
}

export const config = {
  matcher: '/uploads/:path*',
} 