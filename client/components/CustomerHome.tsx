import Link from "next/link";
import type { Ticket, TicketStatus } from "@/lib/types";
import { statusLabel } from "@/lib/format";
import { STATUS_FILTER_OPTIONS } from "@/lib/ticketStatus";
import { TicketCard } from "./TicketCard";
import { EmptyState, Skeleton } from "./ui";
import { PageToolbar } from "./AppShell";
import { cn } from "@/lib/cn";
import { newTicketPath } from "@/lib/routes";

export function CustomerHome({
  title = "Tickets",
  subtitle = "Track every request from open to resolved.",
  tickets,
  visible,
  status,
  setStatus,
  loading,
}: {
  title?: string;
  subtitle?: string;
  tickets: Ticket[];
  visible: Ticket[];
  status: TicketStatus | "ALL";
  setStatus: (value: TicketStatus | "ALL") => void;
  loading: boolean;
}) {
  return (
    <div className="space-y-5">
      <PageToolbar title={title} subtitle={subtitle} />

      <div className="flex flex-wrap gap-1.5">
        {STATUS_FILTER_OPTIONS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStatus(s)}
            className={cn(
              "rounded-full px-3.5 py-1.5 text-xs transition",
              status === s ? "bg-accent text-white" : "text-muted hover:text-white",
            )}
          >
            {s === "ALL" ? "All" : statusLabel(s, true)}
          </button>
        ))}
      </div>

      {loading
        ? Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-28" />)
        : visible.map((ticket) => <TicketCard key={ticket.id} ticket={ticket} audience="customer" />)}

      {!loading && visible.length === 0 ? (
        tickets.length === 0 ? (
          <EmptyState
            title="No tickets yet"
            body="Open a ticket and an agent will pick it up. You can keep talking in the thread until it is resolved."
          >
            <Link href={newTicketPath()} className="mt-4 inline-flex rounded-full bg-accent px-4 py-2 text-sm font-medium text-white">
              New ticket
            </Link>
          </EmptyState>
        ) : (
          <EmptyState title="Nothing in this filter" body="Switch back to All to see every ticket." />
        )
      ) : null}
    </div>
  );
}
