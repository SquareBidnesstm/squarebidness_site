/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.supabase.co" },
      { protocol: "https", hostname: "network.squarebidness.com" },
      { protocol: "https", hostname: "squarebidness.com" },
    ],
  },
};

export default nextConfig;
