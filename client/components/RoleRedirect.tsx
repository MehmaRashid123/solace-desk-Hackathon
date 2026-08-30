"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { APP_NAME } from "@/lib/brand";
import type { Role } from "@/lib/types";

type RoleRedirectProps = {
  to: (role: Role) => string;
};

export function RoleRedirect({ to }: RoleRedirectProps) {
  const { user, ready } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!ready) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    router.replace(to(user.role));
  }, [ready, router, to, user]);

  return <div className="grid min-h-screen place-items-center text-secondary">Loading {APP_NAME}…</div>;
}
