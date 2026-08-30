import jwt from "jsonwebtoken";
import crypto from "node:crypto";
import { config } from "../config.js";
import type { Role } from "@prisma/client";

export type AccessPayload = {
  sub: string;
  email: string;
  role: Role;
  name: string;
};

export function signAccessToken(payload: AccessPayload) {
  return jwt.sign(payload, config.jwtAccessSecret, {
    expiresIn: config.accessTtl as jwt.SignOptions["expiresIn"],
  });
}

export function verifyAccessToken(token: string) {
  return jwt.verify(token, config.jwtAccessSecret) as AccessPayload;
}

export function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function newRefreshToken() {
  return crypto.randomBytes(48).toString("hex");
}

export function refreshExpiry() {
  const match = /^(\d+)([dhms])$/.exec(config.refreshTtl);
  const now = Date.now();
  if (!match) return new Date(now + 7 * 24 * 60 * 60 * 1000);
  const n = Number(match[1]);
  const unit = match[2];
  const ms =
    unit === "d" ? n * 86400000 : unit === "h" ? n * 3600000 : unit === "m" ? n * 60000 : n * 1000;
  return new Date(now + ms);
}
