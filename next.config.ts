import type { NextConfig } from 'next';
const config: NextConfig = {
  output: 'standalone',
  serverExternalPackages: ['aws-sdk'],
  poweredByHeader: false,
  async headers() { return [{ source: '/api/:path*', headers: [{ key: 'Cache-Control', value: 'no-store' }] }]; }
};
export default config;
