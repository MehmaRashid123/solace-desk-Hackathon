"use client";

import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import type { Ticket } from "@/lib/types";
import { ticketDetailPath } from "@/lib/routes";
import { relativeTime, statusLabel } from "@/lib/format";
import { Glass, PriorityChip, StatusBadge } from "./ui";

export function TicketCard({ ticket, audience = "agent" }: { ticket: Ticket; audience?: "customer" | "agent" }) {
  const { user } = useAuth();
  const customer = audience === "customer";
  const href = user ? ticketDetailPath(user.role, ticket.id) : "/login";
  return (
    <Link href={href} className="block">
      <Glass className="mb-2 p-4 transition hover:bg-white/[0.04]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-wider text-white/35">{ticket.ticketNumber}</p>
            <p className="mt-1 font-medium">{ticket.subject}</p>
            {customer ? <p className="mt-1 line-clamp-1 text-sm text-white/40">{ticket.description}</p> : null}
          </div>
          <div className="flex items-center gap-2">
            {customer ? (
              <span className="rounded-full bg-white/5 px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-wide text-white/70 ring-1 ring-white/10">
                {statusLabel(ticket.status, true)}
              </span>
            ) : (
              <>
                <PriorityChip priority={ticket.priority} />
                <StatusBadge status={ticket.status} />
              </>
            )}
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-white/40">
          <span>{ticket.category ?? (customer ? "Category pending" : "Needs review")}</span>
          {customer ? (
            <span>{ticket.assignedAgent?.name ? `Agent · ${ticket.assignedAgent.name}` : "Waiting for an agent"}</span>
          ) : (
            <>
              <span>{ticket.customer?.name ?? "Customer"}</span>
              <span>{ticket.assignedAgent?.name ?? "Unassigned"}</span>
            </>
          )}
          <span>Updated {relativeTime(ticket.updatedAt)}</span>
        </div>
      </Glass>
    </Link>
  );
}
