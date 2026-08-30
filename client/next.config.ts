import type { NextConfig } from "next";

const defaultApiUrl = "https://solace-desk-hackathon.onrender.com";

function trimUrl(url: string | undefined, fallback: string) {
  return (url ?? fallback).trim().replace(/\/+$/, "");
}

const nextConfig: NextConfig = {
  reactStrictMode: true,
  env: {
    NEXT_PUBLIC_API_URL: trimUrl(process.env.NEXT_PUBLIC_API_URL, defaultApiUrl),
    NEXT_PUBLIC_SOCKET_URL: trimUrl(
      process.env.NEXT_PUBLIC_SOCKET_URL,
      trimUrl(process.env.NEXT_PUBLIC_API_URL, defaultApiUrl),
    ),
  },
};

export default nextConfig;
