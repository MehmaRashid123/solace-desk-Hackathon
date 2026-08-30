"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { dashboardPath } from "@/lib/routes";
import type { Role } from "@/lib/types";
import { APP_NAME } from "@/lib/brand";

type RoleGuardProps = {
  allowedRoles: Role[];
  children: React.ReactNode;
};

export function RoleGuard({ allowedRoles, children }: RoleGuardProps) {
  const { user, ready } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!ready) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    if (!allowedRoles.includes(user.role)) {
      router.replace(dashboardPath(user.role));
    }
  }, [allowedRoles, ready, router, user]);

  if (!ready || !user || !allowedRoles.includes(user.role)) {
    return <div className="grid min-h-screen place-items-center text-secondary">Loading {APP_NAME}…</div>;
  }

  return children;
}
