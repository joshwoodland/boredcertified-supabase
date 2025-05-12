import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@/app/utils/supabase/server';
import { createAdminClient } from '@/app/utils/supabase/server-admin';

type CookieObject = { name: string; value: string | undefined };

export async function GET(_req: NextRequest) {
  try {
    /* ───────────── Gather cookies ───────────── */
    const cookieStore = cookies(); // ReadonlyRequestCookies
    const allCookies: CookieObject[] = Array.from(cookieStore).map(
      ([name, cookie]) => ({
        name,
        value: cookie?.value ?? undefined,
      })
    );

    const cookieNames = allCookies.map((c) => c.name);
    const authCookies = allCookies.filter(
      (c) => c.name.includes('-auth-token') || c.name.includes('sb-')
    );

    // Log the number of cookies found
    console.log('[AUTH DEBUG API] Total cookies:', allCookies.length);
    console.log('[AUTH DEBUG API] Auth cookies found:', authCookies.length);

    /* ───────────── Supabase clients ─────────── */
    // Use standardized client initialization with error handling
    const supabase = createClient();
    if (!supabase) {
      throw new Error('Failed to initialize Supabase client');
    }

    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    // createAdminClient is async → await it
    const adminClient = await createAdminClient();
    if (!adminClient) {
      throw new Error('Failed to initialize Supabase admin client');
    }

    /* ───────────── Admin checks ─────────────── */
    let adminChecks: Record<string, unknown> = {};
    let userRecord: Record<string, unknown> | null = null;

    if (session?.user?.id) {
      const { data: authUser, error: authUserError } = await adminClient
        .from('users')
        .select('*')
        .eq('id', session.user.id)
        .single();

      const { data: userExists, error: userExistsError } =
        await adminClient.rpc('auth.uid_exists', { uid: session.user.id });

      const { data: userMetadata, error: userMetadataError } =
        await adminClient
          .from('auth.users')
          .select(
            'email, phone, confirmed_at, last_sign_in_at, created_at, updated_at, is_anonymous'
          )
          .eq('id', session.user.id)
          .single();

      userRecord = userMetadata ?? null;

      adminChecks = {
        userExistsInAuth: userExists === true,
        userExistsError: userExistsError?.message,
        authUserFound: !!authUser,
        authUserError: authUserError?.message,
        userMetadata: userMetadata
          ? {
              email: userMetadata.email,
              confirmed: !!userMetadata.confirmed_at,
              lastSignIn: userMetadata.last_sign_in_at,
              created: userMetadata.created_at,
              isAnonymous: userMetadata.is_anonymous,
            }
          : null,
        userMetadataError: userMetadataError?.message,
      };
    }

    /* ───────────── Return JSON ──────────────── */
    return NextResponse.json({
      timestamp: new Date().toISOString(),
      cookies: {
        count: allCookies.length,
        names: cookieNames,
        authCookies: authCookies.map((c) => ({
          name: c.name,
          value:
            c.value && c.value.length > 20
              ? `${c.value.slice(0, 20)}…`
              : c.value ?? 'undefined',
        })),
      },
      auth: {
        sessionExists: !!session,
        sessionError: sessionError?.message,
        session: session
          ? {
              userId: session.user.id,
              email: session.user.email,
              provider: session.user.app_metadata?.provider,
              expiresAt: session.expires_at
                ? new Date(session.expires_at * 1000).toISOString()
                : null,
            }
          : null,
      },
      adminChecks,
      userRecord,
      environment: {
        nodeEnv: process.env.NODE_ENV,
        supabaseUrlConfigured: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
        supabaseAnonKeyConfigured: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        supabaseServiceKeyConfigured: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      },
    });
  } catch (err) {
    console.error('Auth debug API error:', err);
    return NextResponse.json(
      {
        error: 'Server debug error',
        message: err instanceof Error ? err.message : 'Unknown error',
        stack:
          process.env.NODE_ENV === 'development' && err instanceof Error
            ? err.stack
            : null,
      },
      { status: 500 }
    );
  }
}
