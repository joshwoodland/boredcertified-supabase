# Environment Variables Setup for Vercel

This application requires specific environment variables to be set in Vercel for Supabase integration. The console errors you're seeing indicate that these variables are missing or not properly configured in your Vercel dashboard.

## Required Environment Variables in Vercel

You need to set these variables in your **Vercel Dashboard → Project Settings → Environment Variables**:

### Production Variables
```bash
# Public Supabase URL (safe for client-side)
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co

# Public Supabase Anonymous Key (safe for client-side)  
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here

# Service Role Key (server-side only, sensitive)
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here

# App URL for OAuth redirects
NEXT_PUBLIC_APP_URL=https://your-vercel-domain.vercel.app
```

## Setting Variables in Vercel

1. **Go to your Vercel dashboard**: https://vercel.com/dashboard
2. **Select your project**
3. **Go to Settings → Environment Variables**
4. **Add each variable**:
   - Variable Name: `NEXT_PUBLIC_SUPABASE_URL`
   - Value: Your Supabase URL
   - Environment: Production, Preview, Development (check all)
   - Click "Save"
5. **Repeat for all variables**

## Where to Find Supabase Values

1. **Go to your Supabase project dashboard**: https://supabase.com/dashboard
2. **Click on your project**
3. **Go to Settings → API**
4. **Copy the values**:
   - `URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY`

## For Local Development

If you need to test locally, create a `.env.local` file:

```bash
# For local development only
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## Important Notes

- **Vercel automatically loads environment variables** - no code changes needed
- **Use the same variable names** exactly as shown above
- **NEXT_PUBLIC_** variables are exposed to the browser
- **Service role key is server-side only** and sensitive

## Troubleshooting Auth Issues

The issues you're experiencing are caused by:

1. **Missing environment variables in Vercel** - Fix by setting them in Vercel dashboard
2. **Multiple Supabase client instances** - This has been cleaned up in the codebase
3. **OAuth redirect configuration** - Make sure Supabase has correct redirect URLs

### OAuth Redirect URLs in Supabase

In your Supabase project dashboard:

1. Go to **Authentication → URL Configuration**
2. Add these URLs:
   - **Production**: `https://your-vercel-domain.vercel.app/auth/callback`
   - **Preview**: `https://your-preview-url.vercel.app/auth/callback`
   - **Development**: `http://localhost:3000/auth/callback`

## After Setting Variables

1. **Redeploy your Vercel app** (environment variables require a redeploy)
2. **Check the deployment logs** for any environment variable errors
3. **Test the auth flow** with Google OAuth

## Vercel CLI Alternative

You can also set variables using Vercel CLI:

```bash
vercel env add NEXT_PUBLIC_SUPABASE_URL
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY  
vercel env add SUPABASE_SERVICE_ROLE_KEY
vercel env add NEXT_PUBLIC_APP_URL
```

## Testing Variables

To test if variables are loaded correctly, check your deployment logs or add a debug API route that shows environment variable status (without exposing sensitive values). 