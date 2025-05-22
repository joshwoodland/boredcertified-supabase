/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  // Explicitly set environment variables to ensure they're available
  // Note: Only server-side code can access non-NEXT_PUBLIC_ variables
  env: {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    // Add build timestamp to help track deployments
    NEXT_PUBLIC_BUILD_TIME: new Date().toISOString(),
    // DEEPGRAM_API_KEY should NOT be exposed to the client
  },
  // Explicitly include DEEPGRAM_API_KEY in serverRuntimeConfig
  serverRuntimeConfig: {
    DEEPGRAM_API_KEY: process.env.DEEPGRAM_API_KEY,
  },
  // Add experimental features for better WebSocket support
  experimental: {
    // Enable edge runtime for better performance
    runtime: 'nodejs',
    // Optimize for serverless environments
    isrMemoryCacheSize: 0,
  },
  // Headers configuration for CORS and WebSocket support
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          {
            key: 'Access-Control-Allow-Origin',
            value: '*',
          },
          {
            key: 'Access-Control-Allow-Methods',
            value: 'GET, POST, PUT, DELETE, OPTIONS',
          },
          {
            key: 'Access-Control-Allow-Headers',
            value: 'Content-Type, Authorization, X-Requested-With',
          },
          {
            key: 'Cache-Control',
            value: 'no-cache, no-store, must-revalidate',
          },
        ],
      },
    ];
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