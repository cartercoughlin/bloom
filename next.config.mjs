/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  // For Capacitor mobile development with backend API routes
  // We'll deploy this to Vercel and point Capacitor to the deployed URL
}

export default nextConfig
