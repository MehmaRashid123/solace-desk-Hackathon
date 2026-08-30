"use client";

import type { LucideIcon } from "lucide-react";
import { AlertTriangle, Hash, Sparkles, Tag, UserRound } from "lucide-react";
import { cn } from "@/lib/cn";

type InfoPill = {
  icon: LucideIcon;
  label: string;
  value: string;
  accent?: boolean;
};

export function TicketInfoPills({ pills, statusPill }: { pills: InfoPill[]; statusPill?: string }) {
  return (
    <div className="flex flex-wrap gap-2">
      {pills.map((pill) => (
        <span
          key={pill.label}
          className={cn(
            "inline-flex items-center gap-2 rounded-pill border px-3 py-1.5 text-xs",
            pill.accent ? "border-accent/30 bg-accent/10" : "border-white/10 bg-white/[0.04]",
          )}
        >
          <pill.icon size={12} className={pill.accent ? "text-accent" : "text-muted"} />
          <span className="text-muted">{pill.label}</span>
          <span className="font-medium text-white">{pill.value}</span>
        </span>
      ))}
      {statusPill ? (
        <span className="inline-flex items-center rounded-pill bg-accent/15 px-3 py-1.5 text-xs font-medium text-accent">
          {statusPill}
        </span>
      ) : null}
    </div>
  );
}

export const ticketPillIcons = {
  ticket: Hash,
  category: Tag,
  worker: UserRound,
  urgency: AlertTriangle,
  confidence: Sparkles,
};
