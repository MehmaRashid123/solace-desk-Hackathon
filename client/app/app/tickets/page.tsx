"use client";

import { RoleRedirect } from "@/components/RoleRedirect";
import { ticketsPath } from "@/lib/routes";

export default function LegacyTicketsRedirect() {
  return <RoleRedirect to={ticketsPath} />;
}
