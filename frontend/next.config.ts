import type { NextConfig } from "next";

const backendUrl = (
  process.env.BACKEND_URL ??
  (process.env.NODE_ENV === "production"
    ? "https://repload.onrender.com"
    : "http://localhost:4000")
).replace(/\/+$/, "");

const nextConfig: NextConfig = {
  experimental: {
    agentFeedback: true,
  },
  cacheComponents: true,
  partialPrefetching: true,
  async rewrites() {
    return [
      {
        source: "/api/backend/:path*",
        destination: `${backendUrl}/:path*`,
      },
    ];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
