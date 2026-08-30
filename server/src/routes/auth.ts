import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { hashToken, newRefreshToken, refreshExpiry, signAccessToken } from "../lib/jwt.js";
import { clearRefreshCookie, REFRESH_COOKIE, setRefreshCookie } from "../lib/cookies.js";
import { publicUser } from "../lib/publicUser.js";
import { auth, currentUser } from "../middleware/auth.js";
import { sendFail, sendOk } from "../lib/respond.js";
import { authLimiter } from "../middleware/rateLimit.js";

export const authRouter = Router();

const registerSchema = z.object({
  name: z.string().min(2).max(80),
  email: z.string().email(),
  password: z.string().min(8).max(72),
  role: z.enum(["CUSTOMER", "AGENT"]).optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

async function issueSession(
  user: { id: string; email: string; name: string; role: "CUSTOMER" | "AGENT" | "ADMIN"; avatarHue: number; createdAt: Date },
) {
  const accessToken = signAccessToken({
    sub: user.id,
    email: user.email,
    role: user.role,
    name: user.name,
  });
  const refreshRaw = newRefreshToken();
  await prisma.refreshToken.create({
    data: {
      token: hashToken(refreshRaw),
      userId: user.id,
      expiresAt: refreshExpiry(),
    },
  });
  return { accessToken, refreshRaw, user: publicUser(user) };
}

authRouter.post("/register", authLimiter, async (req, res, next) => {
  try {
    const body = registerSchema.parse(req.body);
    const exists = await prisma.user.findUnique({ where: { email: body.email.toLowerCase() } });
    if (exists) {
      sendFail(res, 409, "Email already registered");
      return;
    }
    const user = await prisma.user.create({
      data: {
        name: body.name,
        email: body.email.toLowerCase(),
        passwordHash: await bcrypt.hash(body.password, 12),
        role: body.role ?? "CUSTOMER",
        avatarHue: Math.floor(Math.random() * 360),
      },
    });
    const session = await issueSession(user);
    setRefreshCookie(res, session.refreshRaw);
    sendOk(res, { accessToken: session.accessToken, user: session.user }, 201);
  } catch (err) {
    next(err);
  }
});

authRouter.post("/login", authLimiter, async (req, res, next) => {
  try {
    const body = loginSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { email: body.email.toLowerCase() } });
    if (!user || !(await bcrypt.compare(body.password, user.passwordHash))) {
      sendFail(res, 401, "Invalid email or password");
      return;
    }
    const session = await issueSession(user);
    setRefreshCookie(res, session.refreshRaw);
    sendOk(res, { accessToken: session.accessToken, user: session.user });
  } catch (err) {
    next(err);
  }
});

authRouter.post("/refresh", async (req, res, next) => {
  try {
    const raw = req.cookies?.[REFRESH_COOKIE] as string | undefined;
    if (!raw) {
      sendFail(res, 401, "No refresh cookie");
      return;
    }
    const hashed = hashToken(raw);
    const stored = await prisma.refreshToken.findUnique({
      where: { token: hashed },
      include: { user: true },
    });
    if (!stored || stored.expiresAt < new Date()) {
      clearRefreshCookie(res);
      if (stored) await prisma.refreshToken.delete({ where: { id: stored.id } }).catch(() => undefined);
      sendFail(res, 401, "Refresh token expired");
      return;
    }

    await prisma.refreshToken.delete({ where: { id: stored.id } });
    const session = await issueSession(stored.user);
    setRefreshCookie(res, session.refreshRaw);
    sendOk(res, { accessToken: session.accessToken, user: session.user });
  } catch (err) {
    next(err);
  }
});

authRouter.post("/logout", async (req, res, next) => {
  try {
    const raw = req.cookies?.[REFRESH_COOKIE] as string | undefined;
    if (raw) {
      await prisma.refreshToken.deleteMany({ where: { token: hashToken(raw) } });
    }
    clearRefreshCookie(res);
    sendOk(res, { ok: true });
  } catch (err) {
    next(err);
  }
});

authRouter.get("/me", auth, async (req, res, next) => {
  try {
    const { sub } = currentUser(req);
    const user = await prisma.user.findUnique({ where: { id: sub } });
    if (!user) {
      sendFail(res, 404, "User not found");
      return;
    }
    sendOk(res, { user: publicUser(user) });
  } catch (err) {
    next(err);
  }
});
