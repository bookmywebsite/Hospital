/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: ['img.clerk.com', 'images.clerk.dev'],
  },
  allowedDevOrigins: [
    'aquarial-scrappingly-brittanie.ngrok-free.dev',
  ],
  experimental: {
    serverActions: {
      allowedOrigins: [
        'aquarial-scrappingly-brittanie.ngrok-free.dev',
      ],
    },
  },
  eslint: {
    ignoreDuringBuilds: true,  // ← disables ALL eslint during build
  },
  typescript: {
    ignoreBuildErrors: true,   // ← disables TypeScript errors during build
  },
};

export default nextConfig;