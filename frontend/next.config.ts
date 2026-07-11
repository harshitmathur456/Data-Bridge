import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  output: "standalone",

  // Tell Next.js (both Turbopack & Webpack) NOT to bundle these server-only
  // packages — they are only used inside API routes, never in client code.
  serverExternalPackages: ["@google/generative-ai", "@supabase/supabase-js"],

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
