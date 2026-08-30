"use client";

import Link from "next/link";
import { LoaderCircle, Star } from "lucide-react";
import { useEffect, useState } from "react";
import { DonutStat } from "@/components/dashboard";
import { Avatar, Button, Glass } from "@/components/ui";
import { api } from "@/lib/api";
import { theme } from "@/lib/theme";
import type { WorkerProfile } from "@/lib/types";
import { cn } from "@/lib/cn";

function StarRating({ rating, count }: { rating: number; count: number }) {
  const filled = Math.round(rating);
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((n) => (
          <Star
            key={n}
            size={13}
            className={cn(n <= filled ? "fill-amber-400 text-amber-400" : "text-white/20")}
          />
        ))}
      </div>
      <span className="text-xs text-secondary">
        {rating > 0 ? rating.toFixed(1) : "New"} · {count} review{count === 1 ? "" : "s"}
      </span>
    </div>
  );
}

type WorkerCardProps = {
  worker: WorkerProfile;
  compact?: boolean;
  selected?: boolean;
  selecting?: boolean;
  href?: string;
  onSelect?: () => void;
};

export function WorkerCard({ worker, compact, selected, selecting, href, onSelect }: WorkerCardProps) {
  const workloadTotal = worker.activeTickets + worker.completedTickets + worker.replyCount;

  const card = (
    <Glass
      className={cn(
        "p-4 transition",
        selected && "ring-2 ring-accent/50",
        !worker.isAvailable && "opacity-60",
        href && "hover:bg-white/[0.04] cursor-pointer",
      )}
    >
      <div className="flex items-start gap-3">
        <Avatar name={worker.name} hue={worker.avatarHue} size="lg" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium text-primary">{worker.name}</p>
            {worker.category ? (
              <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] uppercase tracking-wide text-secondary">
                {worker.category}
              </span>
            ) : null}
            {!worker.isAvailable ? (
              <span className="rounded-full bg-danger/15 px-2 py-0.5 text-[10px] text-danger">Offline</span>
            ) : null}
          </div>
          <div className="mt-1">
            <StarRating rating={worker.avgRating} count={worker.ratingCount} />
          </div>
        </div>
      </div>

      {!compact ? (
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <DonutStat
            total={workloadTotal || 1}
            centerLabel="Workload"
            segments={[
              { label: "Active tickets", value: worker.activeTickets, color: theme.accent },
              { label: "Completed", value: worker.completedTickets, color: theme.success },
              { label: "Replies sent", value: worker.replyCount, color: theme.chart },
            ]}
          />
          <div className="space-y-2">
            <p className="text-[11px] uppercase tracking-wider text-secondary">Recent reviews</p>
            {worker.recentReviews.length === 0 ? (
              <p className="text-xs text-muted">No reviews yet</p>
            ) : (
              worker.recentReviews.map((review, i) => (
                <div key={i} className="rounded-xl bg-white/[0.04] px-3 py-2 text-xs">
                  <div className="flex items-center gap-1 text-amber-400">
                    {Array.from({ length: review.stars }).map((_, j) => (
                      <Star key={j} size={10} className="fill-current" />
                    ))}
                    <span className="ml-1 text-secondary">· {review.customerName}</span>
                  </div>
                  {review.comment ? <p className="mt-1 text-muted line-clamp-2">{review.comment}</p> : null}
                </div>
              ))
            )}
          </div>
        </div>
      ) : (
        <div className="mt-3 space-y-2">
          {worker.recentReviews.slice(0, 2).map((review, i) => (
            <div key={i} className="rounded-xl bg-white/[0.04] px-3 py-2 text-xs">
              <div className="flex items-center gap-1 text-amber-400">
                {Array.from({ length: review.stars }).map((_, j) => (
                  <Star key={j} size={10} className="fill-current" />
                ))}
                <span className="ml-1 text-secondary">{review.customerName}</span>
              </div>
              {review.comment ? <p className="mt-1 text-muted line-clamp-2">{review.comment}</p> : null}
            </div>
          ))}
          {worker.recentReviews.length === 0 ? (
            <p className="text-xs text-muted">No reviews yet — be the first to rate!</p>
          ) : null}
        </div>
      )}

      {onSelect ? (
        <Button
          variant="pill"
          className="mt-4 w-full"
          disabled={!worker.isAvailable || selecting}
          onClick={onSelect}
        >
          {selecting ? (
            <span className="inline-flex items-center gap-2">
              <LoaderCircle size={14} className="animate-spin" />
              Selecting…
            </span>
          ) : (
            "Select this worker"
          )}
        </Button>
      ) : null}
    </Glass>
  );

  if (href) {
    return (
      <Link href={href} className="block">
        {card}
      </Link>
    );
  }

  return card;
}

type WorkerSelectionPanelProps = {
  accessToken: string;
  suggestedIds?: string[];
  selectingId: string | null;
  onSelect: (workerId: string) => void;
};

export function WorkerSelectionPanel({ accessToken, suggestedIds, selectingId, onSelect }: WorkerSelectionPanelProps) {
  const [workers, setWorkers] = useState<WorkerProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    setError("");
    void api<{ workers: WorkerProfile[] }>("/workers", { token: accessToken })
      .then((r) => {
        const suggested = new Set(suggestedIds ?? []);
        const sorted = [...r.workers].sort((a, b) => {
          const aSuggested = suggested.has(a.id) ? 0 : 1;
          const bSuggested = suggested.has(b.id) ? 0 : 1;
          if (aSuggested !== bSuggested) return aSuggested - bSuggested;
          return b.avgRating - a.avgRating;
        });
        setWorkers(sorted);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load workers"))
      .finally(() => setLoading(false));
  }, [accessToken, suggestedIds]);

  if (loading) {
    return (
      <Glass className="p-5">
        <p className="text-sm text-muted">Loading available workers…</p>
      </Glass>
    );
  }

  if (error) {
    return (
      <Glass className="p-5">
        <p className="text-sm text-rose-300">{error}</p>
      </Glass>
    );
  }

  if (workers.length === 0) {
    return (
      <Glass className="p-5">
        <p className="text-sm text-muted">No workers available right now. Please check back soon.</p>
      </Glass>
    );
  }

  return (
    <Glass className="p-5">
      <h2 className="text-sm font-medium">Choose your worker</h2>
      <p className="mt-1 text-xs text-muted">Compare ratings and reviews, then pick who should handle your ticket.</p>
      <div className="mt-4 space-y-3">
        {workers.map((worker) => (
          <WorkerCard
            key={worker.id}
            worker={worker}
            compact
            selecting={selectingId === worker.id}
            onSelect={() => onSelect(worker.id)}
          />
        ))}
      </div>
    </Glass>
  );
}
