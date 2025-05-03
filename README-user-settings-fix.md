# User Authentication Settings Fix

## Problem Description

The application currently has an issue where user authentication information is being correctly loaded, but the user-specific settings aren't being properly associated with the authenticated user. This is causing the following symptoms:

1. User can successfully authenticate through Supabase Auth
2. The User ID from authentication is visible in the auth section
3. However, the User ID is not appearing in the User Settings section
4. Changes to settings are not persisting for a specific user

## Root Cause Analysis

After investigation, the primary issues are:

1. **Row Level Security (RLS) Policies**: The `app_settings` table in Supabase needs proper Row Level Security policies to allow users to:
   - Read their own settings
   - Read default settings
   - Insert their own settings
   - Update their own settings

2. **Foreign Key Constraint**: There is already a foreign key from `app_settings.user_id` to `auth.users(id)`, which is good for data integrity but requires additional handling.

## Solution

The solution involves:

1. **Setting up proper RLS policies** in Supabase
2. **Ensuring correct permissions** for all roles
3. **Fixing how user settings are created and updated** in the API

## Fix Implementation

### 1. Apply the RLS Fixes

**Using SQL in the Supabase Dashboard** (Recommended)

1. Open your Supabase project dashboard (https://app.supabase.com/)
2. Navigate to the SQL Editor
3. Copy and paste the contents of `scripts/fix-settings-rls.sql`
4. Run the SQL script
5. Check the messages to confirm the policies were created successfully

This approach is preferred as it directly executes SQL statements against your database.

> Note: The JavaScript script route (running `node scripts/fix-settings-rls.js`) will not work unless you have enabled the `exec_sql` function in your Supabase instance, which is disabled by default for security reasons.

### 2. Verify the Fix

1. Navigate to `/auth-settings-test` in your application
2. Log in with your Google account
3. Check that:
   - The User ID from authentication appears in both the auth section AND the settings section
   - Changes to settings persist when you log out and log back in

## RLS Policies Created

The scripts create the following RLS policies:

1. **Select own settings**: Allows users to read their own settings
   ```sql
   CREATE POLICY "Select own settings" 
   ON public.app_settings
   FOR SELECT
   USING (auth.uid() = user_id);
   ```

2. **Select public settings**: Allows everyone to read default settings
   ```sql
   CREATE POLICY "Select public settings" 
   ON public.app_settings
   FOR SELECT
   USING (user_id IS NULL);
   ```

3. **Insert own settings**: Allows users to create settings linked to their ID
   ```sql
   CREATE POLICY "Insert own settings" 
   ON public.app_settings
   FOR INSERT
   WITH CHECK (auth.uid() = user_id);
   ```

4. **Update own settings**: Allows users to update only their own settings
   ```sql
   CREATE POLICY "Update own settings" 
   ON public.app_settings
   FOR UPDATE
   USING (auth.uid() = user_id);
   ```

## Application Flow

After applying these fixes, the settings flow will work as follows:

1. When a user logs in, the application checks if they have settings in the database
2. If user-specific settings exist, those are loaded
3. If no user-specific settings exist, a copy of the default settings is created for the user
4. When settings are updated, only the user's specific settings are modified
5. When a user logs out, they see the default settings

## Troubleshooting

If you're still experiencing issues:

1. **Check the browser console** for any auth or settings errors
2. **Check the server logs** for RLS-related errors
3. **Verify user permissions** in Supabase
4. **Look for missing user_id values** in the database

## Additional Context

This fix relies on the fact that there is already a foreign key constraint between `app_settings.user_id` and `auth.users(id)`, which prevents creating settings for non-existent users. This constraint is important for data integrity, but required special handling in our code.

The code now properly handles:
- First-time users without existing settings
- Authentication state changes
- Default settings for unauthenticated users
- RLS policies for database security
