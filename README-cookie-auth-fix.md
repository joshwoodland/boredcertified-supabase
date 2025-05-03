# Supabase Cookie Authentication Fix

## Problem Summary

We identified a critical issue in the authentication system where the application was unable to properly parse Supabase auth cookies. This manifested as:

1. Authentication state flashing between logged in/out
2. Server-side routes failing to recognize authenticated users
3. Error logs showing: `Failed to parse cookie string: [SyntaxError: Unexpected token 'b', "base64-eyJ"... is not valid JSON]`
4. Cookies were being set correctly, but their format (base64-encoded) wasn't being properly handled

## Root Cause

The issue stemmed from how Supabase encodes authentication cookies. Instead of storing plain JSON, it sometimes uses base64 encoding with a `base64-` prefix. The standard JSON parser was trying to parse this directly, leading to the error.

## Solution Implemented

### 1. Cookie Debugging Tools

Created a dedicated cookie debugging page at `/cookie-debug` that:
- Shows all cookies present in the browser
- Highlights authentication-related cookies
- Provides tools to decode and inspect base64-encoded cookies
- Reports client-side vs server-side authentication status

### 2. Middleware Enhancement

Updated the middleware to properly handle Supabase cookies:

- Switched from manual cookie parsing to using `createMiddlewareClient`
- Added proper error handling to prevent crashes
- Implemented a custom cookie parser that can handle both JSON and base64-encoded cookies
- Made `/cookie-debug` accessible without authentication for easier troubleshooting

### 3. Supabase Client Utility Refactoring

Refactored `app/lib/supabase.ts` to:

- Provide a consistent approach to creating Supabase clients
- Improve error handling with try/catch blocks and fallbacks
- Enhance logging to better diagnose issues
- Add a `withSupabase` utility function for safer Supabase operations
- Ensure consistent cookie handling across all Supabase operations

### 4. API Route Updates

Updated key API routes to use the improved pattern:

- `app/api/settings/route.ts` now uses the server component client consistently
- Added more robust error handling to prevent crashes
- Improved logging for better diagnostics
- Better fallback mechanisms when operations fail

## How to Test the Fix

1. Visit `/cookie-debug` to inspect cookies and authentication state
2. Test authentication by logging in and out
3. Verify server-side operations like fetching settings and patient data work consistently

## Prevention of Future Issues

- Always use the same Supabase client instance within a single request flow
- Prefer the `createServerComponentSupabaseClient` function for server components
- Never mix different client creation methods in the same operation
- Be aware that cookies may be encoded in different formats

## Implementation Pattern for Future API Routes

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createServerComponentSupabaseClient } from '@/app/lib/supabase';
import { cookies } from 'next/headers';

export async function GET(request: NextRequest) {
  try {
    // Always use this pattern for consistency
    const cookieStore = cookies();
    const supabaseServer = createServerComponentSupabaseClient(() => cookieStore);
    
    // Get the user session
    const { data: { session } } = await supabaseServer.auth.getSession();
    
    // Use the SAME client instance for subsequent operations
    const { data, error } = await supabaseServer
      .from('your_table')
      .select('*');
      
    // Proper error handling
    if (error) throw error;
    
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error in API route:', error);
    return NextResponse.json({ error: 'Operation failed' }, { status: 500 });
  }
}
```

This fix ensures that authentication works correctly across the application, with proper cookie handling and consistent client usage.
