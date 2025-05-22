import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * Environment variable checker for Vercel deployments
 * This route helps debug environment variable issues without exposing sensitive values
 */
export async function GET() {
  try {
    const envCheck = {
      timestamp: new Date().toISOString(),
      platform: {
        isVercel: !!process.env.VERCEL,
        vercelEnv: process.env.VERCEL_ENV || 'unknown',
        nodeEnv: process.env.NODE_ENV || 'unknown',
        vercelUrl: process.env.VERCEL_URL || 'not-set',
      },
      supabaseConfig: {
        supabaseUrl: {
          exists: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
          length: process.env.NEXT_PUBLIC_SUPABASE_URL?.length || 0,
          preview: process.env.NEXT_PUBLIC_SUPABASE_URL?.substring(0, 20) + '...' || 'not-set'
        },
        anonKey: {
          exists: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
          length: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.length || 0,
          preview: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.substring(0, 20) + '...' || 'not-set'
        },
        serviceRoleKey: {
          exists: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
          length: process.env.SUPABASE_SERVICE_ROLE_KEY?.length || 0,
          // Never show service role key content, even partially
          status: process.env.SUPABASE_SERVICE_ROLE_KEY ? 'configured' : 'missing'
        },
        appUrl: {
          exists: !!process.env.NEXT_PUBLIC_APP_URL,
          value: process.env.NEXT_PUBLIC_APP_URL || 'not-set'
        }
      },
      recommendations: [] as string[]
    };

    // Add recommendations based on missing variables
    const recommendations: string[] = [];

    if (!envCheck.supabaseConfig.supabaseUrl.exists) {
      recommendations.push('Set NEXT_PUBLIC_SUPABASE_URL in Vercel dashboard');
    }

    if (!envCheck.supabaseConfig.anonKey.exists) {
      recommendations.push('Set NEXT_PUBLIC_SUPABASE_ANON_KEY in Vercel dashboard');
    }

    if (!envCheck.supabaseConfig.serviceRoleKey.exists) {
      recommendations.push('Set SUPABASE_SERVICE_ROLE_KEY in Vercel dashboard');
    }

    if (!envCheck.supabaseConfig.appUrl.exists) {
      recommendations.push('Set NEXT_PUBLIC_APP_URL in Vercel dashboard');
    }

    if (envCheck.platform.isVercel && recommendations.length > 0) {
      recommendations.push('Redeploy your Vercel app after setting environment variables');
    }

    if (!envCheck.platform.isVercel && recommendations.length > 0) {
      recommendations.push('Create a .env.local file with the required variables for local development');
    }

    envCheck.recommendations = recommendations;

    return NextResponse.json(envCheck);
  } catch (error) {
    console.error('Environment check error:', error);
    return NextResponse.json(
      {
        error: 'Environment check failed',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
} 