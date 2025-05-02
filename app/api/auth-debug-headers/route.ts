import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  // Extract headers from the request
  const headers: Record<string, string> = {};
  
  // Convert headers to a plain object
  request.headers.forEach((value, key) => {
    // Don't include authorization headers directly for security
    if (key.toLowerCase() === 'authorization' || key.toLowerCase() === 'cookie') {
      headers[key] = '[REDACTED FOR SECURITY]';
    } else {
      headers[key] = value;
    }
  });

  // Add information about cookies without exposing values
  const cookieNames = request.cookies.getAll().map(cookie => cookie.name);
  headers['cookies-detected'] = cookieNames.join(', ');
  
  // Check for auth cookie specifically
  const hasAuthCookie = request.cookies.getAll()
    .some(cookie => cookie.name.includes('-auth-token'));
  headers['auth-cookie-present'] = hasAuthCookie ? 'Yes' : 'No';
  
  return NextResponse.json({ 
    headers,
    message: 'Auth debug headers retrieved successfully'
  });
}
