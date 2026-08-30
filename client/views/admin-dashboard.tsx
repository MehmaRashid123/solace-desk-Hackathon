"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ArrowRight, RefreshCw } from "lucide-react";
import { PageToolbar } from "@/components/DashboardLayout";
import { StatCard } from "@/components/dashboard";
import { useAuth } from "@/context/AuthContext";
import { useSocket } from "@/context/SocketContext";
import { api } from "@/lib/api";
import { relativeTime } from "@/lib/format";
import { adminWorkersPath } from "@/lib/routes";
import type { AdminOverview, Ticket } from "@/lib/types";
import { Avatar, Glass, Skeleton, StatusBadge } from "@/components/ui";
import { isNew, isPendingWorkerResponse } from "@/lib/ticketStatus";
function CustomerQueryCard({ ticket }: { ticket: Ticket }) {
  const waitingForWorker = isNew(ticket.status) && !ticket.assignedAgentId;
  return (
    <Glass className="p-4">
      <div className="flex items-start gap-3">
        <Avatar name={ticket.customer?.name ?? "Customer"} hue={ticket.customer?.avatarHue ?? 200} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium text-primary">{ticket.customer?.name ?? "Customer"}</p>
            <StatusBadge status={ticket.status} />
          </div>
          <p className="mt-1 text-[11px] uppercase tracking-wider text-secondary">{ticket.ticketNumber}</p>
          <p className="mt-1 text-sm text-primary">{ticket.subject}</p>
          <p className="mt-1 line-clamp-2 text-xs text-muted">{ticket.description}</p>
          <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-secondary">
            <span>{ticket.category || ticket.aiCategory || "General"}</span>
            <span>Updated {relativeTime(ticket.updatedAt)}</span>
            {waitingForWorker ? <span className="text-accent">Waiting for worker selection</span> : null}
            {isPendingWorkerResponse(ticket.status) && ticket.assignedAgent ? (
              <span>Selected · {ticket.assignedAgent.name}</span>
            ) : null}
          </div>
        </div>
      </div>
    </Glass>
  );
}

export default function AdminDashboardPage() {
  const { accessToken } = useAuth();
  const { socket } = useSocket();
  const [data, setData] = useState<AdminOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!accessToken) return;
    setLoading(true);
    setError(null);
    void api<AdminOverview>("/admin/overview", { token: accessToken })
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load overview"))
      .finally(() => setLoading(false));
  }, [accessToken]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!socket) return;
    const refresh = () => load();
    socket.on("admin:workerSelected", refresh);
    socket.on("ticket:statusChanged", refresh);
    return () => {
      socket.off("admin:workerSelected", refresh);
      socket.off("ticket:statusChanged", refresh);
    };
  }, [socket, load]);

  if (loading && !data) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-20" />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4 text-center">
        <p className="text-secondary">{error}</p>
        <button type="button" onClick={load} className="inline-flex items-center gap-2 text-sm text-accent hover:underline">
          <RefreshCw size={14} />
          Try again
        </button>
      </div>
    );
  }

  const summary = data?.summary;

  return (
    <div className="space-y-8">
      <PageToolbar
        title="Admin overview"
        subtitle="All customer queries and worker performance in one place."
        onRefresh={load}
      />

      {summary ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <StatCard label="New queries" value={summary.newQueries} />
          <StatCard label="Pending response" value={summary.pendingSelection} />
          <StatCard label="Active tickets" value={summary.activeTickets} />
          <StatCard label="Resolved" value={summary.completedTickets} />
          <StatCard label="Workers online" value={`${summary.availableWorkers}/${summary.totalWorkers}`} />
        </div>
      ) : null}

      <section>
        <h2 className="text-lg font-semibold text-primary">Customer queries</h2>
        <p className="mt-1 text-sm text-muted">Latest tickets from customers — new ones waiting for a worker, or pending worker response.</p>
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {(data?.customerQueries ?? []).length === 0 ? (
            <Glass className="p-6 text-sm text-muted">No open customer queries right now.</Glass>
          ) : (
            data?.customerQueries.map((ticket) => <CustomerQueryCard key={ticket.id} ticket={ticket} />)
          )}
        </div>
      </section>

      <section>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-primary">Workers</h2>
            <p className="mt-1 text-sm text-muted">
              {summary?.totalWorkers ?? 0} workers · {summary?.availableWorkers ?? 0} online
            </p>
          </div>
          <Link
            href={adminWorkersPath()}
            className="inline-flex items-center gap-1 text-sm text-accent hover:underline"
          >
            View all workers
            <ArrowRight size={14} />
          </Link>
        </div>
      </section>    </div>
  );
}
