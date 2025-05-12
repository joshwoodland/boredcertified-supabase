'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';

import { createServerClient } from '@/app/lib/supabase';

export async function login(formData: FormData) {
  const supabaseServerOrNull = createServerClient();
  if (!supabaseServerOrNull) {
    console.error('[login/actions] Failed to initialize Supabase server client');
    redirect('/error');
  }
  const supabase = supabaseServerOrNull;

  // type-casting here for convenience
  // in practice, you should validate your inputs
  const data = {
    email: formData.get('email') as string,
    password: formData.get('password') as string,
  };

  const { error } = await supabase.auth.signInWithPassword(data)

  if (error) {
    redirect('/error');
  }

  revalidatePath('/', 'layout');
  redirect('/');
}

export async function signup(formData: FormData) {
  const supabaseServerOrNull = createServerClient();
  if (!supabaseServerOrNull) {
    console.error('[signup/actions] Failed to initialize Supabase server client');
    redirect('/error');
  }
  const supabase = supabaseServerOrNull;

  // type-casting here for convenience
  // in practice, you should validate your inputs
  const data = {
    email: formData.get('email') as string,
    password: formData.get('password') as string,
  };

  const { error } = await supabase.auth.signUp(data);

  if (error) {
    redirect('/error');
  }

  revalidatePath('/', 'layout');
  redirect('/');
}

export async function loginWithGoogle() {
  const supabaseServerOrNull = createServerClient();
  if (!supabaseServerOrNull) {
    console.error('[loginWithGoogle/actions] Failed to initialize Supabase server client');
    return { error: 'Failed to initialize auth client' };
  }
  const supabase = supabaseServerOrNull;

  // Determine the redirect URL dynamically
  // Use environment variable if available, otherwise construct from request
  let redirectUrl;
  if (process.env.NEXT_PUBLIC_APP_URL) {
    redirectUrl = process.env.NEXT_PUBLIC_APP_URL;
  } else {
    // Get the host from request headers to determine the correct port
    const headersList = headers();
    const host = headersList.get('host') || 'localhost:3000';
    
    // This is a fallback if the env var is not available
    redirectUrl = process.env.NODE_ENV === 'development' 
      ? `http://${host}`
      : 'https://yourdomain.com'; // Replace with your production domain
  }

  // Add debugging
  console.log('[AUTH] Initiating Google OAuth login with redirect URL:', redirectUrl);
  
  try {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectUrl,
        queryParams: {
          // These params ensure you get refresh tokens for longer sessions
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    });

    if (error) {
      console.error('[AUTH] OAuth error:', error.message);
      return { error: error.message };
    }

    if (data?.url) {
      console.log('[AUTH] Successfully generated OAuth URL:', data.url.substring(0, 100) + '...');
      return { url: data.url };
    }

    console.error('[AUTH] No URL returned from OAuth provider');
    return { error: 'Failed to get login URL' };
  } catch (err) {
    console.error('[AUTH] Unexpected error in loginWithGoogle:', err);
    return { error: err instanceof Error ? err.message : 'Unknown error during authentication' };
  }
}
