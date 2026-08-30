"use client";

import { RoleRedirect } from "@/components/RoleRedirect";
import { newTicketPath } from "@/lib/routes";

export default function LegacyNewTicketRedirect() {
  return <RoleRedirect to={() => newTicketPath()} />;
}
