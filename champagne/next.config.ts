import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Foto's worden client-side verkleind, maar laat wat marge.
      bodySizeLimit: "8mb",
    },
  },
};

export default nextConfig;
