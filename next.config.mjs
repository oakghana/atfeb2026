/** @type {import('next').NextConfig} */
const nextConfig = {
  swcMinify: true,
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true, // Simplify for now to avoid turbopack image processing
  },
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production' ? {
      exclude: ['error', 'warn'],
    } : false,
  },
  productionBrowserSourceMaps: false,
  poweredByHeader: false,
  reactStrictMode: true,
  // Force SWC instead of Turbopack
  experimental: {
    optimizePackageImports: [
      'lucide-react',
      'date-fns',
    ],
  },
}

export default nextConfig
