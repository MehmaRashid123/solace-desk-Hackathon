"use client";

import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import type { Ticket } from "@/lib/types";
import type { Role } from "@/lib/types";
import { statusLabel } from "@/lib/format";
import { ticketDetailPath } from "@/lib/routes";
import { Glass, PriorityChip } from "./ui";

type DuplicateTicketsPanelProps = {
  duplicates: Ticket[];
  currentId: string;
  role: Role;
};

export function DuplicateTicketsPanel({ duplicates, currentId, role }: DuplicateTicketsPanelProps) {
  const others = duplicates.filter((t) => t.id !== currentId);
  if (others.length === 0) return null;

  return (
    <Glass className="p-4">
      <div className="flex items-start gap-2">
        <AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber-400" />
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-medium text-primary">Similar open tickets</h2>
          <p className="mt-1 text-xs text-muted">
            These may be duplicates — check before opening a new request.
          </p>
          <ul className="mt-3 space-y-2">
            {others.map((ticket) => (
              <li key={ticket.id}>
                <Link
                  href={ticketDetailPath(role, ticket.id)}
                  className="block rounded-xl bg-white/[0.04] px-3 py-2 transition hover:bg-white/[0.07]"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[11px] uppercase tracking-wider text-secondary">{ticket.ticketNumber}</span>
                    <PriorityChip priority={ticket.priority} />
                    <span className="text-[11px] text-muted">{statusLabel(ticket.status, role === "CUSTOMER")}</span>
                  </div>
                  <p className="mt-0.5 truncate text-sm text-primary">{ticket.subject}</p>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Glass>
  );
}
