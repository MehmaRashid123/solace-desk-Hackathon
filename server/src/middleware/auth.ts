import type { NextFunction, Request, Response } from "express";
import type { Role } from "@prisma/client";
import { verifyAccessToken, type AccessPayload } from "../lib/jwt.js";
import { HttpError } from "../lib/httpError.js";
import { sendFail } from "../lib/respond.js";

declare module "express-serve-static-core" {
  interface Request {
    user?: AccessPayload;
  }
}

export type AuthedRequest = Request & { user: AccessPayload };

export function currentUser(req: Request): AccessPayload {
  if (!req.user) throw new HttpError(401, "Unauthenticated");
  return req.user;
}

export function routeId(req: Request, key = "id") {
  const value = req.params[key];
  return Array.isArray(value) ? value[0] : value;
}

export function auth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : undefined;
  if (!token) {
    sendFail(res, 401, "Missing access token");
    return;
  }
  try {
    req.user = verifyAccessToken(token);
    next();
  } catch {
    sendFail(res, 401, "Invalid or expired access token");
  }
}

export function requireRole(...roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = req.user;
    if (!user || !roles.includes(user.role)) {
      sendFail(res, 403, "Forbidden");
      return;
    }
    next();
  };
}
