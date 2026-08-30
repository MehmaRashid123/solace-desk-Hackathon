import type { CookieOptions, Response } from "express";
import { config } from "../config.js";

const REFRESH_COOKIE = "lumen_refresh";

function cookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: config.nodeEnv === "production",
    sameSite: config.nodeEnv === "production" ? "none" : "lax",
    path: "/",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  };
}

export function setRefreshCookie(res: Response, token: string) {
  res.cookie(REFRESH_COOKIE, token, cookieOptions());
}

export function clearRefreshCookie(res: Response) {
  res.clearCookie(REFRESH_COOKIE, { ...cookieOptions(), maxAge: 0 });
}

export { REFRESH_COOKIE };
