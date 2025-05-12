# Supabase Client Standardization

This document outlines the standardized approach to using Supabase clients in the application. The goal of this standardization is to:

1. Ensure consistent initialization and error handling across the application
2. Provide clear guidance on which client to use in different contexts
3. Improve type safety and developer experience
4. Centralize configuration and dependency management

## Directory Structure

All Supabase client functionality is centralized in the `app/lib/supabase/` directory:

```
app/lib/supabase/
├── admin.ts      # Admin client (bypasses RLS)
├── browser.ts    # Browser client for client components
├── index.ts      # Central export point
├── logger.ts     # Structured logging for Supabase operations
├── server.ts     # Server client for server components/API routes
└── types.ts      # Shared types and utility functions
```

## Client Types

### Browser Client (`browser.ts`)

**Purpose**: For use in client components that run in the browser.

**Key characteristics**:
- Uses the anonymous key
- Respects Row Level Security (RLS) policies
- Handles authentication in the browser
- Session persistence handled automatically

**Usage example**:

```typescript
import { supabaseBrowser, updateUserProfile } from '@/app/lib/supabase';

// Use singleton instance
const { data } = await supabaseBrowser
  .from('public_table')
  .select('*')
  .eq('user_id', supabaseBrowser.auth.getUser()?.data.user?.id);

// Or use helper functions
const result = await updateUserProfile({ 
  username: 'newUsername',
  full_name: 'New Full Name'
});
```

### Server Client (`server.ts`)

**Purpose**: For use in server components and API routes where you need standard access that respects RLS.

**Key characteristics**:
- Uses the anonymous key
- Respects Row Level Security (RLS) policies
- No session persistence to avoid conflicts with server-side rendering
- Safe for general server components and API routes

**Usage example**:

```typescript
import { supabaseServer } from '@/app/lib/supabase';

// In a server component or API route
if (!supabaseServer) {
  throw new Error('Database connection error');
}

const { data, error } = await supabaseServer
  .from('table')
  .select('*')
  .eq('published', true);
```

### Admin Client (`admin.ts`)

**Purpose**: For administrative operations that need to bypass RLS.

**Key characteristics**:
- Uses the service role key with elevated permissions
- Bypasses Row Level Security (RLS) policies
- ⚠️ Must ONLY be used in trusted server environments
- No singleton instance is provided (by design, for security)

**Usage example**:

```typescript
import { createAdminClient } from '@/app/lib/supabase';

// Create admin client only when needed
const adminClient = createAdminClient();
if (!adminClient) {
  return { error: 'Admin operations unavailable' };
}

// Perform operation that bypasses RLS
const { error } = await adminClient
  .from('protected_table')
  .update({ status: 'approved' })
  .eq('id', recordId);
```

## Error Handling

All client modules implement consistent error handling:

1. **Environment variable validation**:
   - Clear error messages when environment variables are missing
   - Throws errors in development mode, logs in production

2. **Null checking**:
   - All client instances may be null if initialization fails
   - Always check for null before using

   ```typescript
   if (!supabaseServer) {
     return { error: 'Database unavailable' };
   }
   ```

3. **Query error handling**:
   - Supabase operations return both data and error objects
   - Always check the error before using the data

   ```typescript
   const { data, error } = await supabaseBrowser.from('table').select('*');
   if (error) {
     console.error('Failed to fetch data:', error.message);
     return { error: 'Failed to load data' };
   }
   ```

4. **Helper functions**:
   - Standardized error return format for all helper functions
   - Return type typically includes `{ success: boolean, error: Error | null }`

## Logging

The `logger.ts` module provides structured logging for Supabase operations:

```typescript
import { createLogger } from '@/app/lib/supabase/logger';

// Create a logger for the specific module
const logger = createLogger('browser');

// Use the logger
logger.info('Fetching user profile');
logger.error('Failed to update profile', error);
```

Configure logging behavior:

```typescript
import { initLogger, LogLevel } from '@/app/lib/supabase/logger';

// Set custom logging configuration
initLogger({
  minLevel: LogLevel.WARN, // Only log warnings and errors
  timestamps: true,        // Include timestamps in logs
  debugMode: true          // Enable verbose logging
});
```

## Typing

Strong typing is provided through the `types.ts` module:

```typescript
import type { TypedSupabaseClient } from '@/app/lib/supabase';

function processData(client: TypedSupabaseClient) {
  // Client is fully typed with your database schema
  const { data } = await client.from('your_table').select('column_name');
}
```

## Best Practices

### When to Use Each Client Type

1. **Browser Client**:
   - Use in client components (.jsx/.tsx files without "use server")
   - For operations that should respect RLS
   - When you need access to the user's session
   - For real-time subscriptions

2. **Server Client**:
   - Use in server components (with "use server" directive)
   - For API routes that should respect RLS
   - When user context comes from cookies/headers
   - For regular server-side data fetching

3. **Admin Client**:
   - Only in trusted server environments (NOT in client code)
   - For maintenance scripts and administrative tasks
   - When you need to bypass RLS for legitimate reasons
   - Always scope to the smallest possible operation

### Code Organization

For complex components or pages, organize Supabase logic in a clear pattern:

```typescript
// 1. Import the appropriate client
import { supabaseBrowser } from '@/app/lib/supabase';

// 2. Define typed data fetching functions
async function fetchUserData(userId: string) {
  if (!supabaseBrowser) return { error: 'Client not initialized' };
  
  const { data, error } = await supabaseBrowser
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();
    
  if (error) return { error };
  return { data };
}

// 3. Use in your component
function UserProfile({ userId }) {
  // ...use fetchUserData
}
```

### Security Considerations

1. **Client code**:
   - Never use the admin client in browser code
   - Don't store sensitive data in client state
   - Rely on RLS for access control

2. **Server code**:
   - Use the admin client sparingly and explicitly
   - Always validate inputs before using in queries
   - Don't expose service role key in client code

3. **API Routes**:
   - Validate user permissions before bypassing RLS
   - Use appropriate status codes for errors
   - Log security-relevant operations

## Migration Guide

If you're migrating from older Supabase client implementations:

1. Replace imports:
   ```typescript
   // Old
   import { supabaseClient } from '@/app/utils/supabase/client';
   // New
   import { supabaseBrowser } from '@/app/lib/supabase';
   ```

2. Check for null:
   ```typescript
   // Add null checking
   if (!supabaseBrowser) {
     return { error: 'Database unavailable' };
   }
   ```

3. Use helper functions when available:
   ```typescript
   // Old
   const { error } = await supabaseClient
     .from('profiles')
     .update({ username: 'new_name' })
     .eq('id', user.id);
     
   // New
   const { success, error } = await updateUserProfile({ 
     username: 'new_name' 
   });
   ```

## Testing

Unit tests for the standardized clients are available in:

- `app/__tests__/supabase/browser.test.ts`
- `app/__tests__/supabase/server.test.ts`
- `app/__tests__/supabase/admin.test.ts`

Run the tests with:

```bash
npm test
```

## Troubleshooting

**Client returns null**: 
- Check `.env.local` for missing environment variables
- Ensure proper casing and naming of environment variables
- In development, an error should be thrown with details

**Type errors**:
- Ensure database types are up-to-date
- Run `supabase gen types typescript --project-id YOUR_PROJECT_ID` to update types
- Check that the correct client type is being used

**Authentication issues**:
- Browser client: Check cookie settings and session handling
- Server client: Ensure cookies are properly passed from client requests
- Admin client: Verify service role key permissions
