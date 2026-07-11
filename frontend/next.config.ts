import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  output: "standalone",

  turbopack: {
    resolveAlias: {
      // Map the @shared path alias
      "@shared": path.resolve(__dirname, "../shared"),
      // Use relative paths to avoid the Windows absolute path Turbopack bug ("windows imports are not implemented yet")
      "@google/generative-ai": "./node_modules/@google/generative-ai",
      "@supabase/supabase-js": "./node_modules/@supabase/supabase-js",
    },
  },

  webpack(config) {
    config.resolve.alias = {
      ...config.resolve.alias,
      "@shared": path.resolve(__dirname, "../shared"),
      "@google/generative-ai": path.resolve(__dirname, "node_modules/@google/generative-ai"),
      "@supabase/supabase-js": path.resolve(__dirname, "node_modules/@supabase/supabase-js"),
    };
    return config;
  },
};

export default nextConfig;
