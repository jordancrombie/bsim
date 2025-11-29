/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.banksim.ca',
      },
      {
        protocol: 'http',
        hostname: 'localhost',
      },
    ],
    // Allow relative paths for uploads served via proxy
    unoptimized: false,
  },
}

module.exports = nextConfig
