import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The fonts that draw post mockups are read from disk at run time (content-studio/post-package.mjs).
  outputFileTracingIncludes: { "/api/studio/[...path]": ["./content-studio/fonts/*"] },
  typescript: {
    ignoreBuildErrors: true,
  },
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
