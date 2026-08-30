"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowRight, Plus, RefreshCw, Star } from "lucide-react";
import { StatCard } from "@/components/dashboard";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import { unwrapTicketList } from "@/lib/apiHelpers";
import { statusLabel } from "@/lib/format";
import type { Ticket } from "@/lib/types";
import { newTicketPath, ticketDetailPath } from "@/lib/routes";
import { Button, Glass, Skeleton } from "@/components/ui";
import { cn } from "@/lib/cn";

import { isCompleted, isInProgress } from "@/lib/ticketStatus";

function customerOpenCount(tickets: Ticket[]) {
  return tickets.filter((t) => !isCompleted(t.status) && t.status !== "Rejected" && t.status !== "Cancelled").length;
}

function customerInProgressCount(tickets: Ticket[]) {
  return tickets.filter((t) => isInProgress(t.status)).length;
}

function customerCompletedCount(tickets: Ticket[]) {
  return tickets.filter((t) => isCompleted(t.status)).length;
}

export default function CustomerDashboardPage() {
  const { user, accessToken } = useAuth();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    setError(null);
    try {
      const ticketsRes = await api<{ tickets: Ticket[] }>("/tickets/mine", { token: accessToken });
      setTickets(unwrapTicketList(ticketsRes));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load your dashboard");
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    void load();
  }, [load]);

  const recentTickets = useMemo(
    () => [...tickets].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()).slice(0, 5),
    [tickets],
  );

  const unratedTicket = useMemo(
    () =>
      tickets.find(
        (ticket) => isCompleted(ticket.status) && ticket.assignedAgentId && !ticket.workerRating,
      ),
    [tickets],
  );

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
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-semibold tracking-tight text-white">
            Welcome back, {user?.name?.split(" ")[0] ?? "there"}
          </h1>
          <p className="mt-1 text-sm text-secondary">Here&apos;s what&apos;s happening with your tickets.</p>
        </div>
        <Link href={newTicketPath()}>
          <Button variant="pill" className="gap-2">
            <Plus size={16} strokeWidth={2.5} />
            New Ticket
          </Button>
        </Link>
      </div>

      {unratedTicket ? (
        <Link
          href={ticketDetailPath("CUSTOMER", unratedTicket.id)}
          className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-accent/30 bg-accent/10 px-4 py-3 transition hover:bg-accent/15"
        >
          <span className="inline-flex items-center gap-2 text-sm text-primary">
            <Star size={16} className="text-accent" fill="currentColor" />
            Rate your recent service
          </span>
          <span className="inline-flex items-center gap-1 text-xs text-secondary">
            {unratedTicket.ticketNumber}
            <ArrowRight size={14} />
          </span>
        </Link>
      ) : null}

      {loading && !tickets.length ? (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-28" />
            ))}
          </div>
          <Skeleton className="h-48" />
        </>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <StatCard label="Open Tickets" value={customerOpenCount(tickets)} />
            <StatCard label="In Progress" value={customerInProgressCount(tickets)} />
            <StatCard label="Completed" value={customerCompletedCount(tickets)} />
          </div>

          <div>
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="text-sm font-medium text-primary">Recent Tickets</h2>
              <Link href="/customer/tickets" className="text-xs text-secondary hover:text-primary">
                View all
              </Link>
            </div>
            {recentTickets.length === 0 ? (
              <Glass className="px-4 py-8 text-center text-sm text-secondary">
                No tickets yet.{" "}
                <Link href={newTicketPath()} className="text-accent hover:underline">
                  Open your first ticket
                </Link>
              </Glass>
            ) : (
              <ul className="space-y-2">
                {recentTickets.map((ticket) => (
                  <li key={ticket.id}>
                    <Link href={ticketDetailPath("CUSTOMER", ticket.id)} className="block">
                      <Glass className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 transition hover:bg-white/[0.04]">
                        <div className="min-w-0">
                          <p className="text-[11px] uppercase tracking-wider text-secondary">{ticket.ticketNumber}</p>
                          <p className="mt-0.5 truncate text-sm font-medium text-primary">{ticket.subject}</p>
                        </div>
                        <span
                          className={cn(
                            "shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-wide ring-1",
                            isCompleted(ticket.status)
                              ? "bg-success/15 text-success ring-success/25"
                              : isInProgress(ticket.status)
                                ? "bg-amber-400/15 text-amber-200 ring-amber-400/20"
                                : "bg-white/5 text-secondary ring-white/10",
                          )}
                        >
                          {statusLabel(ticket.status, true)}
                        </span>
                      </Glass>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}

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
