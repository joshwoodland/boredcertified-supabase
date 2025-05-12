/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  // Explicitly set environment variables to ensure they're available
  env: {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  },
  async rewrites() {
    return [
      {
        source: '/Uploads/:path*',
        destination: '/api/serve-file/:path*',
      },
    ];
  },
};

module.exports = nextConfig;