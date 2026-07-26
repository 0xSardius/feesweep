import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  turbopack: {
    // Monorepo root — a stray lockfile in the user home dir otherwise wins inference
    root: path.join(__dirname, "..", ".."),
  },
};

export default nextConfig;
