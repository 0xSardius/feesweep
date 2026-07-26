import type { NextConfig } from "next";
import { existsSync } from "node:fs";
import path from "node:path";

// Keys live in the monorepo root .env (gitignored); Next only auto-loads from
// the app dir, so pull the root file in at server start.
const rootEnv = path.join(__dirname, "..", "..", ".env");
if (existsSync(rootEnv)) process.loadEnvFile(rootEnv);

const nextConfig: NextConfig = {
  turbopack: {
    // Monorepo root — a stray lockfile in the user home dir otherwise wins inference
    root: path.join(__dirname, "..", ".."),
  },
};

export default nextConfig;
