/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  experimental: {
    serverActions: {
      allowedOrigins: ['localhost:3000'],
    },
  },
  async rewrites() {
    return [
      {
        source: '/uploads/:path*',
        destination: '/api/serve-file/:path*',
      },
    ]
  },
}

module.exports = nextConfig 