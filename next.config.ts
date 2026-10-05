import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Native / WASM packages stay out of the bundle and load from node_modules.
  serverExternalPackages: ["@electric-sql/pglite", "@resvg/resvg-js", "postgres"],
};

export default nextConfig;
