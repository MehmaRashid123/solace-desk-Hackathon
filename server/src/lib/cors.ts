import type { CorsOptions } from "cors";
import { config } from "../config.js";

function isAllowedVercelHost(hostname: string) {
  return hostname === "vercel.app" || hostname.endsWith(".vercel.app");
}

export function isAllowedOrigin(origin: string) {
  if (config.clientOrigins.includes(origin)) return true;
  try {
    return isAllowedVercelHost(new URL(origin).hostname);
  } catch {
    return false;
  }
}

export function corsOrigin(
  origin: string | undefined,
  callback: (err: Error | null, allow?: boolean) => void,
) {
  if (!origin || isAllowedOrigin(origin)) {
    callback(null, true);
    return;
  }
  callback(new Error(`CORS blocked: ${origin}`));
}

export const corsOptions: CorsOptions = {
  origin: corsOrigin,
  credentials: true,
};
