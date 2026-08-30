import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { auth, requireRole, routeId } from "../middleware/auth.js";
import { publicUser } from "../lib/publicUser.js";
import { sendFail, sendOk } from "../lib/respond.js";

export const usersRouter = Router();
usersRouter.use(auth, requireRole("ADMIN"));

const createSchema = z.object({
  name: z.string().min(2).max(80),
  email: z.string().email(),
  password: z.string().min(8).max(72),
  role: z.enum(["CUSTOMER", "AGENT", "ADMIN"]),
});

const roleSchema = z.object({
  role: z.enum(["CUSTOMER", "AGENT", "ADMIN"]),
});

usersRouter.get("/", async (_req, res, next) => {
  try {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      select: { id: true, email: true, name: true, role: true, avatarHue: true, createdAt: true },
    });
    sendOk(res, { users });
  } catch (err) {
    next(err);
  }
});

usersRouter.post("/", async (req, res, next) => {
  try {
    const body = createSchema.parse(req.body);
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
        role: body.role,
        avatarHue: Math.floor(Math.random() * 360),
      },
    });
    sendOk(res, { user: publicUser(user) }, 201);
  } catch (err) {
    next(err);
  }
});

usersRouter.patch("/:id/role", async (req, res, next) => {
  try {
    const body = roleSchema.parse(req.body);
    const user = await prisma.user.update({
      where: { id: routeId(req) },
      data: { role: body.role },
    });
    sendOk(res, { user: publicUser(user) });
  } catch (err) {
    next(err);
  }
});
