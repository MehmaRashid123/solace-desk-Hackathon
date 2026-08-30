"use client";

import { useCallback, useEffect, useState } from "react";
import { Star } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { Avatar, Glass, Skeleton } from "@/components/ui";
import { PageToolbar } from "@/components/AppShell";
import { api } from "@/lib/api";
import { relativeTime } from "@/lib/format";
import type { WorkerProfile, WorkerReview } from "@/lib/types";

function ReviewList({ reviews }: { reviews: WorkerReview[] }) {
  if (reviews.length === 0) {
    return <Glass className="p-6 text-sm text-muted">No customer reviews yet. Reviews appear here after customers rate completed tickets.</Glass>;
  }

  return (
    <div className="grid gap-3">
      {reviews.map((review, i) => (
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
      ))}
    </div>
  );
}

function WorkerProfileSection() {
  const { accessToken } = useAuth();
  const [worker, setWorker] = useState<WorkerProfile | null>(null);
  const [reviews, setReviews] = useState<WorkerReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!accessToken) return;
    setLoading(true);
    setError(null);
    void api<{ worker: WorkerProfile; reviews: WorkerReview[] }>("/workers/me", { token: accessToken })
      .then((r) => {
        setWorker(r.worker);
        setReviews(r.reviews);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load reviews"))
      .finally(() => setLoading(false));
  }, [accessToken]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <div className="mt-6 space-y-3">
        <Skeleton className="h-20" />
        <Skeleton className="h-24" />
      </div>
    );
  }

  if (error) {
    return (
      <Glass className="mt-6 p-4 text-sm text-rose-300">
        {error}{" "}
        <button type="button" className="underline" onClick={load}>
          Retry
        </button>
      </Glass>
    );
  }

  if (!worker) return null;

  return (
    <div className="mt-6 space-y-4">
      <Glass className="p-5">
        <p className="text-[11px] uppercase tracking-wider text-secondary">Your rating</p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <div className="flex gap-0.5 text-amber-400">
            {[1, 2, 3, 4, 5].map((n) => (
              <Star
                key={n}
                size={16}
                className={n <= Math.round(worker.avgRating) ? "fill-current" : "text-white/20"}
              />
            ))}
          </div>
          <span className="text-sm text-primary">
            {worker.avgRating > 0 ? worker.avgRating.toFixed(1) : "No rating yet"} · {worker.ratingCount} review
            {worker.ratingCount === 1 ? "" : "s"}
          </span>
        </div>
        <p className="mt-3 text-xs text-muted">
          {worker.completedTickets} completed ticket{worker.completedTickets === 1 ? "" : "s"} · {worker.replyCount} replies
          sent
        </p>
      </Glass>

      <div>
        <h2 className="text-sm font-medium text-primary">Customer reviews</h2>
        <div className="mt-3">
          <ReviewList reviews={reviews} />
        </div>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const { user } = useAuth();
  if (!user) return null;

  const isWorker = user.role === "AGENT";

  return (
    <div className="mx-auto max-w-xl">
      <PageToolbar
        title="Account"
        subtitle={isWorker ? "Your worker profile and customer feedback." : "This is the seat you are signed in as."}
      />
      <Glass className="flex items-center gap-4 p-6">
        <Avatar name={user.name} hue={user.avatarHue} size="lg" />
        <div>
          <p className="font-medium">{user.name}</p>
          <p className="text-sm text-white/45">{user.email}</p>
          <p className="mt-1 text-[11px] uppercase tracking-wider text-white/35">{isWorker ? "Worker" : user.role}</p>
        </div>
      </Glass>
      {!isWorker ? (
        <p className="mt-4 text-sm text-white/40">
          {user.role === "CUSTOMER"
            ? "This account can open tickets, choose a worker, and reply until resolved."
            : "This seat sees all customer queries and worker activity across the platform."}
        </p>
      ) : (
        <WorkerProfileSection />
      )}
    </div>
  );
}
