import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep HTTP integration test output separate from the running development server.
  ...(process.env.DEPOT_HTTP_TEST_DIST_DIR ? { distDir: process.env.DEPOT_HTTP_TEST_DIST_DIR } : {}),
  experimental: {
    serverActions: {
      // Allow multipart overhead while evidence actions enforce a 25 MB file limit.
      bodySizeLimit: "30mb",
    },
  },
};

export default nextConfig;
