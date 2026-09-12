import type { NextConfig } from 'next';

const backendInternalUrl = (process.env.BACKEND_INTERNAL_URL ?? 'http://localhost:3000').replace(
  /\/$/,
  '',
);

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${backendInternalUrl}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
