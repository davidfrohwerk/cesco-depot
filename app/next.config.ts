import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Allow multipart overhead while evidence actions enforce a 25 MB file limit.
      bodySizeLimit: "30mb",
    },
  },
};

export default nextConfig;
