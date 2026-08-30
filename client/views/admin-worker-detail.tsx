"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, RefreshCw, Star } from "lucide-react";
import { DonutStat, StatCard } from "@/components/dashboard";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import { normalizePriority, relativeTime } from "@/lib/format";
import { adminWorkersPath } from "@/lib/routes";
import { theme } from "@/lib/theme";
import type { AdminWorkerDetail, Ticket } from "@/lib/types";
import { Avatar, Glass, PriorityChip, Skeleton, StatusBadge } from "@/components/ui";

function AdminTicketRow({ ticket }: { ticket: Ticket }) {
  const priority = ticket.priority ?? (normalizePriority(ticket.aiPriority) || null);
  return (
    <Glass className="p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] uppercase tracking-wider text-secondary">{ticket.ticketNumber}</p>
          <p className="mt-0.5 font-medium text-primary">{ticket.subject}</p>
          <p className="mt-1 line-clamp-2 text-xs text-muted">{ticket.description}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-secondary">
            <span>{ticket.customer?.name ?? "Customer"}</span>
            <span>·</span>
            <span>{ticket.category || ticket.aiCategory || "General"}</span>
            <span>·</span>
            <span>Updated {relativeTime(ticket.updatedAt)}</span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <PriorityChip priority={priority} />
          <StatusBadge status={ticket.status} />
        </div>
      </div>
    </Glass>
  );
}

export default function AdminWorkerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { accessToken } = useAuth();
  const [data, setData] = useState<AdminWorkerDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!accessToken || !id) return;
    setLoading(true);
    setError(null);
    void api<AdminWorkerDetail>(`/admin/workers/${id}`, { token: accessToken })
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load worker"))
      .finally(() => setLoading(false));
  }, [accessToken, id]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading && !data) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-40" />
        <div className="grid gap-3 sm:grid-cols-3">
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4 text-center">
        <p className="text-secondary">{error}</p>
        <Link href={adminWorkersPath()} className="text-sm text-accent hover:underline">
          Back to workers
        </Link>
      </div>
    );
  }

  if (!data) return null;

  const { worker, reviews, tickets } = data;
  const workloadTotal = worker.activeTickets + worker.completedTickets + worker.replyCount;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href={adminWorkersPath()} className="inline-flex items-center gap-2 text-sm text-secondary hover:text-primary">
          <ArrowLeft size={16} />
          All workers
        </Link>
        <button type="button" onClick={load} className="inline-flex items-center gap-2 text-sm text-secondary hover:text-primary">
          <RefreshCw size={14} />
          Refresh
        </button>
      </div>

      <Glass className="p-6">
        <div className="flex flex-wrap items-start gap-4">
          <Avatar name={worker.name} hue={worker.avatarHue} size="lg" />
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-semibold text-primary">{worker.name}</h1>
            <p className="text-sm text-secondary">{worker.email}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {worker.category ? (
                <span className="rounded-full bg-white/5 px-2.5 py-0.5 text-[11px] uppercase tracking-wide text-secondary">
                  {worker.category}
                </span>
              ) : null}
              <span
                className={
                  worker.isAvailable
                    ? "rounded-full bg-success/15 px-2.5 py-0.5 text-[11px] text-success"
                    : "rounded-full bg-danger/15 px-2.5 py-0.5 text-[11px] text-danger"
                }
              >
                {worker.isAvailable ? "Online" : "Offline"}
              </span>
            </div>
            <div className="mt-3 flex items-center gap-1 text-amber-400">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star
                  key={i}
                  size={14}
                  className={i < Math.round(worker.avgRating) ? "fill-current" : "text-white/20"}
                />
              ))}
              <span className="ml-2 text-sm text-secondary">
                {worker.avgRating > 0 ? worker.avgRating.toFixed(1) : "No rating"} · {worker.ratingCount} reviews
              </span>
            </div>
          </div>
        </div>
      </Glass>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="grid gap-3 sm:grid-cols-3">
          <StatCard label="Active tickets" value={worker.activeTickets} />
          <StatCard label="Completed" value={worker.completedTickets} />
          <StatCard label="Replies sent" value={worker.replyCount} />
        </div>
        <Glass className="p-5">
          <DonutStat
            total={workloadTotal || 1}
            centerLabel="Workload"
            segments={[
              { label: "Active", value: worker.activeTickets, color: theme.accent },
              { label: "Completed", value: worker.completedTickets, color: theme.success },
              { label: "Replies", value: worker.replyCount, color: theme.chart },
            ]}
          />
        </Glass>
      </div>

      <section>
        <h2 className="text-lg font-semibold text-primary">Reviews</h2>
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {reviews.length === 0 ? (
            <Glass className="p-6 text-sm text-muted">No customer reviews yet.</Glass>
          ) : (
            reviews.map((review, i) => (
              <Glass key={i} className="p-4">
                <div className="flex items-center gap-1 text-amber-400">
                  {Array.from({ length: review.stars }).map((_, j) => (
                    <Star key={j} size={12} className="fill-current" />
                  ))}
                  <span className="ml-2 text-xs text-secondary">{review.customerName}</span>
                </div>
                {review.comment ? <p className="mt-2 text-sm text-muted">{review.comment}</p> : null}
                <p className="mt-2 text-[11px] text-secondary">{relativeTime(review.createdAt)}</p>
              </Glass>
            ))
          )}
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-primary">Assigned work</h2>
        <p className="mt-1 text-sm text-muted">All tickets this worker has handled or is working on.</p>
        <div className="mt-4 space-y-3">
          {tickets.length === 0 ? (
            <Glass className="p-6 text-sm text-muted">No tickets assigned yet.</Glass>
          ) : (
            tickets.map((ticket) => <AdminTicketRow key={ticket.id} ticket={ticket} />)
          )}
        </div>
      </section>
    </div>
  );
}
