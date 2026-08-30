"use client";

import { useParams } from "next/navigation";
import { RoleRedirect } from "@/components/RoleRedirect";
import { ticketDetailPath } from "@/lib/routes";

export default function LegacyTicketDetailRedirect() {
  const { id } = useParams<{ id: string }>();
  return <RoleRedirect to={(role) => ticketDetailPath(role, id)} />;
}
