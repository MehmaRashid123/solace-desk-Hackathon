import type { NextConfig } from "next";

const defaultApiUrl = "https://solace-desk-hackathon.onrender.com";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL ?? defaultApiUrl,
    NEXT_PUBLIC_SOCKET_URL: process.env.NEXT_PUBLIC_SOCKET_URL ?? process.env.NEXT_PUBLIC_API_URL ?? defaultApiUrl,
  },
};

export default nextConfig;
