"use client";

import { useState } from "react";
import type { TicketPriority, TicketStatus } from "@/lib/types";
import { cn } from "@/lib/cn";
import { Button, PriorityChip, StatusBadge, Textarea } from "./ui";

const URGENCIES: { value: TicketPriority; label: string }[] = [
  { value: "LOW", label: "Low" },
  { value: "MEDIUM", label: "Medium" },
  { value: "HIGH", label: "High" },
];

export type BookingUrgency = TicketPriority;

export type BookingRequestCardProps = {
  ticketNumber: string;
  summary: string;
  timeAgo: string;
  status?: TicketStatus;
  priority?: TicketPriority | null;
  onAccept: (urgency: BookingUrgency) => void | Promise<void>;
  onReject: (reason: string) => void | Promise<void>;
  busy?: boolean;
};

type PanelMode = "idle" | "accept" | "reject";

export function BookingRequestCard({
  ticketNumber,
  summary,
  timeAgo,
  status,
  priority,
  onAccept,
  onReject,
  busy = false,
}: BookingRequestCardProps) {
  const [mode, setMode] = useState<PanelMode>("idle");
  const [urgency, setUrgency] = useState<BookingUrgency>("MEDIUM");
  const [reason, setReason] = useState("");

  async function confirmAccept() {
    await onAccept(urgency);
    setMode("idle");
  }

  async function confirmReject() {
    const trimmed = reason.trim();
    if (!trimmed) return;
    await onReject(trimmed);
    setReason("");
    setMode("idle");
  }

  return (
    <div className="rounded-card border border-card bg-white/[0.03] p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-medium text-primary">{ticketNumber}</p>
            {status ? <StatusBadge status={status} /> : null}
            <PriorityChip priority={priority ?? null} />
          </div>
          <p className="mt-1 text-sm leading-relaxed text-secondary">{summary}</p>
          <p className="mt-1 text-[11px] text-secondary">{timeAgo}</p>
        </div>

        {mode === "idle" ? (
          <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
            <Button
              type="button"
              variant="ghost"
              className="border border-danger/50 px-4 py-2 text-danger hover:bg-danger/10"
              disabled={busy}
              onClick={() => setMode("reject")}
            >
              Reject
            </Button>
            <Button type="button" variant="pill" className="px-4 py-2" disabled={busy} onClick={() => setMode("accept")}>
              Accept
            </Button>
          </div>
        ) : null}
      </div>

      {mode === "accept" ? (
        <div className="mt-4 border-t border-card pt-4">
          <p className="text-[11px] uppercase tracking-[0.14em] text-secondary">Select urgency</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {URGENCIES.map((level) => (
              <button
                key={level.value}
                type="button"
                disabled={busy}
                onClick={() => setUrgency(level.value)}
                className={cn(
                  "rounded-pill px-3 py-1.5 text-xs font-medium transition",
                  urgency === level.value
                    ? "bg-accent text-primary"
                    : "border border-card bg-white/[0.04] text-secondary hover:text-primary",
                )}
              >
                {level.label}
              </button>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button type="button" variant="pill" className="px-4 py-2" disabled={busy} onClick={() => void confirmAccept()}>
              Confirm accept
            </Button>
            <Button type="button" variant="ghost" className="px-4 py-2" disabled={busy} onClick={() => setMode("idle")}>
              Cancel
            </Button>
          </div>
        </div>
      ) : null}

      {mode === "reject" ? (
        <div className="mt-4 border-t border-card pt-4">
          <p className="text-[11px] uppercase tracking-[0.14em] text-secondary">Reason for rejection</p>
          <Textarea
            className="mt-2 min-h-[72px] text-sm"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Let the customer know why you cannot take this booking…"
            disabled={busy}
          />
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              type="button"
              variant="ghost"
              className="border border-danger/50 px-4 py-2 text-danger hover:bg-danger/10"
              disabled={busy || !reason.trim()}
              onClick={() => void confirmReject()}
            >
              Confirm reject
            </Button>
            <Button type="button" variant="ghost" className="px-4 py-2" disabled={busy} onClick={() => setMode("idle")}>
              Cancel
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
