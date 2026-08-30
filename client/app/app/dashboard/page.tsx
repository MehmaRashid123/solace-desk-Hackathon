"use client";

import { RoleRedirect } from "@/components/RoleRedirect";
import { dashboardPath } from "@/lib/routes";

export default function LegacyDashboardRedirect() {
  return <RoleRedirect to={dashboardPath} />;
}
