import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  output: "standalone",

  // Keep server-only packages out of the client bundle
  serverExternalPackages: ["@google/generative-ai", "@supabase/supabase-js"],

  // Turbopack alias (dev server)
  turbopack: {
    resolveAlias: {
      "@shared": path.resolve(__dirname, "../shared"),
    },
  },

  // Webpack alias (production build)
  webpack(config) {
    config.resolve.alias = {
      ...config.resolve.alias,
      "@shared": path.resolve(__dirname, "../shared"),
    };
    return config;
  },
};

export default nextConfig;
