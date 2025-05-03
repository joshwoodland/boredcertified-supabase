# User Settings with Supabase Auth Integration

This document explains how user-specific settings are managed in the application using Supabase Auth.

## Overview

The application uses Supabase Auth for user authentication and associates user settings with the authenticated user's ID, allowing for:

1. User-specific settings that persist across sessions
2. Default settings for unauthenticated users
3. Secure storage with proper foreign key relationships

## Database Schema

In the Supabase `app_settings` table:

- `id`: Text/UUID - Primary key for each settings record
- `user_id`: UUID - Foreign key reference to `auth.users(id)`, nullable with uniqueness constraint
- Various settings fields like `dark_mode`, `gpt_model`, etc.

## How It Works

1. **Retrieval Process**
   When a user visits the application:
   - The system checks if a user is authenticated via Supabase Auth
   - If authenticated, it retrieves settings where `user_id` matches the authenticated user's ID
   - If no user-specific settings exist, it falls back to default settings (where `user_id` is NULL)

2. **Creation Process**
   When a user updates their settings:
   - If user-specific settings already exist, they are updated
   - If no user-specific settings exist, a new record is created with the user's ID
   - For unauthenticated users, default settings are updated

## Implementation Details

The implementation consists of several key components:

### 1. Supabase Client (app/lib/supabase.ts)

The `getSupabaseAppSettings` function retrieves settings in this order:
- First try: Find settings by user ID
- Fallback: Use default settings

```javascript
export async function getSupabaseAppSettings(userId?: string | null) {
  // Get current user's session to access their ID if not provided
  const { data: { session } } = await supabase.auth.getSession();
  const currentUserId = userId || session?.user?.id;
  
  // Look up settings by user ID if available
  if (currentUserId) {
    const { data, error } = await supabase
      .from('app_settings')
      .select('*')
      .eq('user_id', currentUserId)
      .single();
    
    if (!error && data) return data;
  }
  
  // Fall back to default settings
  const { data } = await supabase
    .from('app_settings')
    .select('*')
    .eq('id', 'default')
    .single();
  
  return data;
}
```

### 2. API Routes (app/api/settings/route.ts)

- GET endpoint: Retrieves settings for the current authenticated user
- POST endpoint: Updates or creates settings for the authenticated user

### 3. React Hook (app/hooks/useAppSettings.ts)

Provides settings data to React components:

```javascript
export function useAppSettings() {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    // Fetch settings from the API...
  }, []);

  return { settings, isLoading, error };
}
```

## Testing

You can test the user settings functionality:

1. Visit `/auth-settings-test` to see:
   - Authentication status and user details
   - Associated settings
   - Raw data for debugging

2. Run the testing script:
   ```
   node scripts/test-user-id-settings.js
   ```

## Troubleshooting

If settings aren't loading correctly:

1. Verify the user is properly authenticated (check user ID in the auth-settings-test page)
2. Ensure the `app_settings` table has the correct schema with a `user_id` column
3. Check that default settings exist in the table
