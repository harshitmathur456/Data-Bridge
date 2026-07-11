import type { NextConfig } from "next";
import path from "path";

// Absolute paths so Turbopack can find packages installed in frontend/node_modules
// when resolving imports from the sibling shared/ directory.
const nm = path.resolve(__dirname, "node_modules");

const nextConfig: NextConfig = {
  output: "standalone",

  // Tell Next.js (both Turbopack & Webpack) NOT to bundle these server-only
  // packages — they are only used inside API routes, never in client code.
  serverExternalPackages: ["@google/generative-ai", "@supabase/supabase-js"],

  turbopack: {
    resolveAlias: {
      // Map the @shared path alias
      "@shared": path.resolve(__dirname, "../shared"),
      // Explicitly point server-only packages to frontend/node_modules so
      // Turbopack can find them when resolving files in ../shared/services/
      "@google/generative-ai": path.join(nm, "@google/generative-ai"),
      "@supabase/supabase-js": path.join(nm, "@supabase/supabase-js"),
    },
  },

  webpack(config) {
    config.resolve.alias = {
      ...config.resolve.alias,
      "@shared": path.resolve(__dirname, "../shared"),
    };
    // Ensure webpack also searches frontend/node_modules when resolving
    // imports that originate from ../shared/**
    config.resolve.modules = [nm, "node_modules"];
    return config;
  },
};

export default nextConfig;
