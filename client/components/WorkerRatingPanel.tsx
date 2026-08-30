"use client";

import { useState } from "react";
import { LoaderCircle, Sparkles, Star } from "lucide-react";
import { api } from "@/lib/api";
import type { Ticket } from "@/lib/types";
import { cn } from "@/lib/cn";
import { Button, Field, Glass, Textarea } from "./ui";
import { useToast } from "@/context/ToastContext";

type WorkerRatingPanelProps = {
  ticket: Ticket;
  accessToken: string;
  onSubmitted: (ticket: Ticket, rating: { id: string; stars: number; comment: string | null }) => void;
};

export function WorkerRatingPanel({ ticket, accessToken, onSubmitted }: WorkerRatingPanelProps) {
  const [stars, setStars] = useState(0);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const { toast } = useToast();

  const workerName = ticket.assignedAgent?.name ?? "your worker";

  async function draftWithAi() {
    setAiBusy(true);
    try {
      const draft = await api<{ stars: number; comment: string }>(`/tickets/${ticket.id}/ai-rating-draft`, {
        method: "POST",
        token: accessToken,
      });
      setStars(draft.stars);
      setComment(draft.comment);
      toast("AI suggested a review — edit if you like, then submit", "ok");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not draft review");
    } finally {
      setAiBusy(false);
    }
  }

  async function submit() {
    if (stars < 1) {
      toast("Pick a star rating first");
      return;
    }
    setBusy(true);
    try {
      const result = await api<{ ticket: Ticket; rating: { id: string; stars: number; comment: string | null } }>(
        `/tickets/${ticket.id}/rating`,
        {
          method: "POST",
          token: accessToken,
          body: { stars, ...(comment.trim() ? { comment: comment.trim() } : {}) },
        },
      );
      onSubmitted(result.ticket, result.rating);
      toast("Thanks — your review was sent to the worker's profile", "ok");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not submit review");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Glass className="p-5">
      <div className="mb-3 flex items-center gap-2">
        <Sparkles size={14} className="text-accent" />
        <h2 className="text-sm font-medium">Rate {workerName}</h2>
      </div>
      <p className="text-xs text-muted">
        This ticket is completed. Share how {workerName} did — your review appears on their worker profile.
      </p>

      <div className="mt-4">
        <p className="text-[11px] uppercase tracking-wider text-secondary">Your rating</p>
        <div className="mt-2 flex gap-1">
          {[1, 2, 3, 4, 5].map((value) => (
            <button
              key={value}
              type="button"
              aria-label={`${value} star${value === 1 ? "" : "s"}`}
              disabled={busy || aiBusy}
              onClick={() => setStars(value)}
              className="rounded-lg p-1 transition hover:bg-white/5"
            >
              <Star
                size={28}
                className={cn(
                  value <= stars ? "fill-amber-400 text-amber-400" : "text-white/25",
                  "transition",
                )}
              />
            </button>
          ))}
        </div>
      </div>

      <Field label="Review (optional)">
        <Textarea
          rows={4}
          className="mt-2"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="What went well? Would you recommend this worker?"
          disabled={busy || aiBusy}
        />
      </Field>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button variant="ghost" disabled={busy || aiBusy} onClick={() => void draftWithAi()}>
          {aiBusy ? (
            <span className="inline-flex items-center gap-2">
              <LoaderCircle size={14} className="animate-spin" />
              Suggesting…
            </span>
          ) : (
            <>
              <Sparkles size={14} />
              Suggest with AI
            </>
          )}
        </Button>
        <Button variant="pill" disabled={busy || aiBusy || stars < 1} onClick={() => void submit()}>
          {busy ? (
            <span className="inline-flex items-center gap-2">
              <LoaderCircle size={14} className="animate-spin" />
              Submitting…
            </span>
          ) : (
            "Submit review"
          )}
        </Button>
      </div>
    </Glass>
  );
}

export function WorkerRatingSubmitted({ ticket }: { ticket: Ticket }) {
  const rating = ticket.workerRating;
  if (!rating) return null;

  return (
    <Glass className="p-5">
      <h2 className="text-sm font-medium">Your review</h2>
      <p className="mt-1 text-xs text-muted">Thanks — this is on {ticket.assignedAgent?.name ?? "the worker"}&apos;s profile.</p>
      <div className="mt-3 flex gap-1">
        {Array.from({ length: rating.stars }).map((_, i) => (
          <Star key={i} size={18} className="fill-amber-400 text-amber-400" />
        ))}
      </div>
      {rating.comment ? <p className="mt-3 text-sm text-muted">{rating.comment}</p> : null}
    </Glass>
  );
}
