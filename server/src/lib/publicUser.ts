import type { User } from "@prisma/client";

export function publicUser(user: Pick<User, "id" | "email" | "name" | "role" | "avatarHue" | "createdAt">) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    avatarHue: user.avatarHue,
    createdAt: user.createdAt,
  };
}
