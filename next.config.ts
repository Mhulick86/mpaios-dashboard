import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "rxbgikvmussdstsjciwt.supabase.co",
      },
    ],
  },
};

export default nextConfig;
