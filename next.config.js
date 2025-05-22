/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  // Explicitly set environment variables to ensure they're available
  // Note: Only server-side code can access non-NEXT_PUBLIC_ variables
  env: {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    // DEEPGRAM_API_KEY should NOT be exposed to the client
  },
  // Explicitly include DEEPGRAM_API_KEY in serverRuntimeConfig
  serverRuntimeConfig: {
    DEEPGRAM_API_KEY: process.env.DEEPGRAM_API_KEY,
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