"use client";

import { RoleRedirect } from "@/components/RoleRedirect";
import { dashboardPath } from "@/lib/routes";

export default function LegacyReportsRedirect() {
  return <RoleRedirect to={dashboardPath} />;
}
