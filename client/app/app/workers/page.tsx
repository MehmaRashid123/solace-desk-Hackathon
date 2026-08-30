"use client";

import { RoleRedirect } from "@/components/RoleRedirect";
import { workerBookingsPath } from "@/lib/routes";

export default function LegacyWorkersRedirect() {
  return <RoleRedirect to={() => workerBookingsPath()} />;
}
