/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: ['img.clerk.com', 'images.clerk.dev'],
  },

  allowedDevOrigins: process.env.NEXT_ALLOWED_DEV_ORIGINS
    ? process.env.NEXT_ALLOWED_DEV_ORIGINS.split(',').map((origin) => origin.trim())
    : [],

  experimental: {
    serverActions: {
      allowedOrigins: process.env.NEXT_ALLOWED_SERVER_ACTION_ORIGINS
        ? process.env.NEXT_ALLOWED_SERVER_ACTION_ORIGINS
            .split(',')
            .map((origin) => origin.trim())
        : [],
    },
  },

  eslint: {
    ignoreDuringBuilds: true,
  },

  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;