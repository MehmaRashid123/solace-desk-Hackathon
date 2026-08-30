"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { LoaderCircle, RefreshCw } from "lucide-react";
import { BookingRequestCard } from "@/components/BookingRequestCard";
import { useAuth } from "@/context/AuthContext";
import { useSocket } from "@/context/SocketContext";
import { api } from "@/lib/api";
import { bookingSummary } from "@/lib/booking";
import { normalizePriority, relativeTime } from "@/lib/format";
import type { Message, Ticket, TicketPriority } from "@/lib/types";
import { ticketDetailPath } from "@/lib/routes";
import { mergeTicketUpdate } from "@/lib/mergeTicket";
import { Button, Field, Glass, PriorityChip, Skeleton, StatusBadge, Textarea } from "@/components/ui";
import { useToast } from "@/context/ToastContext";
import {
  isAccepted,
  isActiveForWorker,
  isInProgress,
  isPendingWorkerResponse,
} from "@/lib/ticketStatus";

function isPendingBooking(ticket: Ticket, workerId: string) {
  return isPendingWorkerResponse(ticket.status) && ticket.assignedAgentId === workerId;
}

function ticketPriority(ticket: Ticket): TicketPriority | null {
  const fromAi = normalizePriority(ticket.aiPriority);
  return ticket.priority ?? (fromAi || null);
}

type ActiveTicketRowProps = {
  ticket: Ticket;
  note: string;
  busy: boolean;
  onNoteChange: (value: string) => void;
  onAdvance: (next: "InProgress" | "Completed") => void | Promise<void>;
};

function ActiveTicketRow({ ticket, note, busy, onNoteChange, onAdvance }: ActiveTicketRowProps) {
  const inProgress = isInProgress(ticket.status);
  const accepted = isAccepted(ticket.status);

  return (
    <Glass className="p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <Link href={ticketDetailPath("AGENT", ticket.id)} className="hover:text-accent">
            <p className="text-[11px] uppercase tracking-wider text-secondary">{ticket.ticketNumber}</p>
            <p className="mt-0.5 font-medium text-primary">{ticket.subject}</p>
          </Link>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <PriorityChip priority={ticketPriority(ticket)} />
            <StatusBadge status={ticket.status} />
          </div>
        </div>
        <p className="text-xs text-secondary">Updated {relativeTime(ticket.updatedAt)}</p>
      </div>

      {accepted ? (
        <Button variant="pill" className="mt-3 w-full sm:w-auto" disabled={busy} onClick={() => void onAdvance("InProgress")}>
          {busy ? (
            <span className="inline-flex items-center gap-2">
              <LoaderCircle size={14} className="animate-spin" />
              Updating…
            </span>
          ) : (
            "Start work"
          )}
        </Button>
      ) : null}

      {inProgress ? (
        <div className="mt-3 space-y-2 border-t border-card pt-3">
          <Field label="Resolution note (required to complete)">
            <Textarea
              rows={2}
              value={note}
              onChange={(e) => onNoteChange(e.target.value)}
              placeholder="Summarize what was done for the customer…"
              disabled={busy}
            />
          </Field>
          <Button
            variant="pill"
            className="w-full sm:w-auto"
            disabled={busy || !note.trim()}
            onClick={() => void onAdvance("Completed")}
          >
            {busy ? (
              <span className="inline-flex items-center gap-2">
                <LoaderCircle size={14} className="animate-spin" />
                Completing…
              </span>
            ) : (
              "Mark completed"
            )}
          </Button>
        </div>
      ) : null}
    </Glass>
  );
}

export default function WorkerDashboardPage() {
  const { user, accessToken } = useAuth();
  const { socket } = useSocket();
  const { toast } = useToast();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [bookingBusyId, setBookingBusyId] = useState<string | null>(null);
  const [statusBusyId, setStatusBusyId] = useState<string | null>(null);
  const [resolutionNotes, setResolutionNotes] = useState<Record<string, string>>({});

  const load = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!accessToken) return;
      if (!opts?.silent) {
        setLoading(true);
        setError(null);
      }
      try {
        const ticketsRes = await api<{ tickets: Ticket[] }>("/tickets/mine", { token: accessToken });
        setTickets(ticketsRes.tickets);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Could not load dashboard";
        if (!opts?.silent) setError(message);
        else toast(message);
      } finally {
        if (!opts?.silent) setLoading(false);
      }
    },
    [accessToken, toast],
  );

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!socket || !user) return;
    const joinDash = () => socket.emit("dashboard:join");
    joinDash();
    socket.on("connect", joinDash);

    const onNewBooking = (ticket: Ticket) => {
      if (ticket.assignedAgentId !== user.id) return;
      void load({ silent: true });
    };

    socket.on("worker:newBooking", onNewBooking);
    return () => {
      socket.off("connect", joinDash);
      socket.off("worker:newBooking", onNewBooking);
      socket.emit("dashboard:leave");
    };
  }, [socket, user, load]);

  const incoming = useMemo(
    () => tickets.filter((t) => user && isPendingBooking(t, user.id)),
    [tickets, user],
  );

  const activeTickets = useMemo(
    () =>
      tickets
        .filter((t) => user && t.assignedAgentId === user.id && isActiveForWorker(t.status))
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()),
    [tickets, user],
  );

  async function acceptBooking(ticketId: string, urgency: TicketPriority) {
    if (!accessToken) return;
    setBookingBusyId(ticketId);
    try {
      const { ticket } = await api<{ ticket: Ticket }>(`/tickets/${ticketId}/respond`, {
        method: "PATCH",
        token: accessToken,
        body: { action: "accept", urgency },
      });
      setTickets((prev) => prev.map((t) => (t.id === ticket.id ? { ...t, ...ticket } : t)));
      toast("Booking accepted", "ok");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not accept booking");
    } finally {
      setBookingBusyId(null);
    }
  }

  async function rejectBooking(ticketId: string, rejectionReason: string) {
    if (!accessToken) return;
    setBookingBusyId(ticketId);
    try {
      const { ticket } = await api<{ ticket: Ticket }>(`/tickets/${ticketId}/respond`, {
        method: "PATCH",
        token: accessToken,
        body: { action: "reject", rejectionReason },
      });
      setTickets((prev) => prev.map((t) => (t.id === ticket.id ? { ...t, ...ticket } : t)));
      toast("Booking declined", "ok");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not decline booking");
    } finally {
      setBookingBusyId(null);
    }
  }

  async function advanceTicket(ticket: Ticket, next: "InProgress" | "Completed") {
    if (!accessToken) return;
    const note = resolutionNotes[ticket.id]?.trim() ?? "";
    if (next === "Completed" && !note) {
      toast("A resolution note is required before completing");
      return;
    }
    setStatusBusyId(ticket.id);
    try {
      const { ticket: updated } = await api<{ ticket: Ticket; message?: Message }>(`/tickets/${ticket.id}/status`, {
        method: "PATCH",
        token: accessToken,
        body: next === "Completed" ? { status: "Completed", resolutionNote: note } : { status: "InProgress" },
      });
      setTickets((prev) =>
        prev.map((t) => (t.id === updated.id ? mergeTicketUpdate(t, updated) : t)),
      );
      toast(next === "Completed" ? "Ticket completed" : "Ticket in progress", "ok");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not update ticket");
    } finally {
      setStatusBusyId(null);
    }
  }

  if (error && !tickets.length) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4 text-center">
        <p className="max-w-sm text-secondary">{error}</p>
        <Button variant="pill" onClick={() => void load()}>
          <RefreshCw size={15} />
          Try again
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[28px] font-semibold tracking-tight text-white">Worker dashboard</h1>
          <p className="mt-1 text-sm text-secondary">Respond to bookings and keep active tickets moving.</p>
        </div>
        <Button variant="ghost" className="gap-2" onClick={() => void load()}>
          <RefreshCw size={15} />
          Refresh
        </Button>
      </div>

      <Glass className="p-4 md:p-5">
        <div className="mb-3">
          <p className="text-sm font-medium text-primary">Incoming bookings</p>
          <p className="mt-1 text-xs text-secondary">Accept sets urgency; reject requires a short reason.</p>
        </div>
        {loading && !tickets.length ? (
          <Skeleton className="h-28" />
        ) : incoming.length === 0 ? (
          <p className="rounded-card border border-dashed border-card px-4 py-6 text-center text-sm text-secondary">
            No pending booking requests right now.
          </p>
        ) : (
          <div className="space-y-3">
            {incoming.map((ticket) => (
              <BookingRequestCard
                key={ticket.id}
                ticketNumber={ticket.ticketNumber}
                summary={bookingSummary(ticket)}
                timeAgo={relativeTime(ticket.createdAt)}
                status={ticket.status}
                priority={ticketPriority(ticket)}
                busy={bookingBusyId === ticket.id}
                onAccept={(urgency) => acceptBooking(ticket.id, urgency)}
                onReject={(reason) => rejectBooking(ticket.id, reason)}
              />
            ))}
          </div>
        )}
      </Glass>

      <div>
        <h2 className="mb-3 text-sm font-medium text-primary">My active tickets</h2>
        {loading && !tickets.length ? (
          <Skeleton className="h-40" />
        ) : activeTickets.length === 0 ? (
          <Glass className="px-4 py-8 text-center text-sm text-secondary">
            No active tickets — accept a booking or check{" "}
            <Link href="/worker/tickets" className="text-accent hover:underline">
              assigned tickets
            </Link>
            .
          </Glass>
        ) : (
          <div className="space-y-3">
            {activeTickets.map((ticket) => (
              <ActiveTicketRow
                key={ticket.id}
                ticket={ticket}
                note={resolutionNotes[ticket.id] ?? ticket.resolutionNote ?? ""}
                busy={statusBusyId === ticket.id}
                onNoteChange={(value) => setResolutionNotes((prev) => ({ ...prev, [ticket.id]: value }))}
                onAdvance={(next) => advanceTicket(ticket, next)}
              />
            ))}
          </div>
        )}
      </div>

      {error && tickets.length ? (
        <p className="text-center text-sm text-danger">
          {error}{" "}
          <button type="button" className="underline hover:text-primary" onClick={() => void load()}>
            Retry
          </button>
        </p>
      ) : null}
    </div>
  );
}
