import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ['127.0.0.1', '192.168.1.240', '10.1.5.3', '10.1.5.5'],
  images: {
    // Product photos live in Supabase Storage; Vercel resizes them to the
    // rendered size and serves WebP/AVIF, so cards stop downloading originals.
    remotePatterns: [
      { protocol: 'https', hostname: '*.supabase.co', pathname: '/storage/v1/object/public/**' },
    ],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '6mb',
    },
  },
};

export default nextConfig;
