import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  output: "standalone",
  turbopack: {
    resolveAlias: {
      "@shared": path.resolve(__dirname, "../shared"),
    },
  },
};

export default nextConfig;
