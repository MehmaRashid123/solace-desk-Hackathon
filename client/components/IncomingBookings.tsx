"use client";

import { useMemo } from "react";
import { BookingRequestCard } from "@/components/BookingRequestCard";
import { useAuth } from "@/context/AuthContext";
import { bookingSummary } from "@/lib/booking";
import { normalizePriority, relativeTime } from "@/lib/format";
import type { Ticket, TicketPriority } from "@/lib/types";
import { Glass } from "@/components/ui";

function ticketPriority(ticket: Ticket): TicketPriority | null {
  const fromAi = normalizePriority(ticket.aiPriority);
  return ticket.priority ?? (fromAi || null);
}

type IncomingBookingsProps = {
  tickets: Ticket[];
  busyId?: string | null;
  onAccept: (ticketId: string, urgency: TicketPriority) => void | Promise<void>;
  onReject: (ticketId: string, reason: string) => void | Promise<void>;
};

export function IncomingBookings({ tickets, busyId, onAccept, onReject }: IncomingBookingsProps) {
  const { user } = useAuth();

  const incoming = useMemo(
    () =>
      tickets.filter(
        (ticket) => ticket.status === "PendingWorkerResponse" && ticket.assignedAgentId === user?.id,
      ),
    [tickets, user?.id],
  );

  if (incoming.length === 0) return null;

  return (
    <Glass className="p-4 md:p-5">
      <div className="mb-3">
        <p className="text-sm font-medium text-primary">Incoming bookings</p>
        <p className="mt-1 text-xs text-secondary">Accept sets urgency; reject requires a short reason.</p>
      </div>
      <div className="space-y-3">
        {incoming.map((ticket) => (
          <BookingRequestCard
            key={ticket.id}
            ticketNumber={ticket.ticketNumber}
            summary={bookingSummary(ticket)}
            timeAgo={relativeTime(ticket.createdAt)}
            status={ticket.status}
            priority={ticketPriority(ticket)}
            busy={busyId === ticket.id}
            onAccept={(urgency) => onAccept(ticket.id, urgency)}
            onReject={(reason) => onReject(ticket.id, reason)}
          />
        ))}
      </div>
    </Glass>
  );
}
