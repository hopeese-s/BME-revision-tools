import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: 'export', // SSG-first strategy for PWA offline capability
  images: {
    unoptimized: true, // Required for static export
  },
};

export default nextConfig;