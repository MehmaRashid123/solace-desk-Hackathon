"use client";

import { LoaderCircle, Sparkles } from "lucide-react";
import { Glass, PriorityChip } from "@/components/ui";
import { CATEGORIES, normalizeCategory, normalizePriority } from "@/lib/format";
import type { TicketPriority } from "@/lib/types";

export type TriageSuggestion = {
  ok: boolean;
  category?: string | null;
  priority?: string | null;
  summary?: string | null;
  source?: string;
  reason?: string;
};

function displayPriority(raw?: string | null): TicketPriority | null {
  const normalized = normalizePriority(raw);
  return normalized || null;
}

export function AiTriageSuggestion({
  suggestion,
  loading,
  compact = false,
}: {
  suggestion: TriageSuggestion | null;
  loading?: boolean;
  compact?: boolean;
}) {
  if (loading) {
    return (
      <Glass className="flex items-center gap-2 p-4 text-sm text-muted">
        <LoaderCircle size={16} className="animate-spin text-accent" />
        Analyzing priority…
      </Glass>
    );
  }

  if (!suggestion) return null;

  if (!suggestion.ok) {
    return (
      <Glass className="p-4 text-sm text-muted">
        <span className="inline-flex items-center gap-1.5 text-secondary">
          <Sparkles size={14} className="text-accent" />
          AI suggestion unavailable
        </span>
        <p className="mt-1 text-xs">Your ticket will still be created — a worker will set priority manually.</p>
      </Glass>
    );
  }

  const category = normalizeCategory(suggestion.category) || suggestion.category || "General";
  const priority = displayPriority(suggestion.priority);

  if (compact) {
    return (
      <Glass className="flex flex-wrap items-center gap-2 p-3">
        <span className="inline-flex items-center gap-1.5 text-xs uppercase tracking-wider text-secondary">
          <Sparkles size={12} className="text-accent" />
          AI suggests
        </span>
        <PriorityChip priority={priority} />
        <span className="rounded-full bg-white/5 px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-wide text-muted ring-1 ring-white/10">
          {category}
        </span>
      </Glass>
    );
  }

  return (
    <Glass className="p-4">
      <div className="flex items-center gap-2">
        <Sparkles size={16} className="text-accent" />
        <h3 className="text-sm font-medium text-primary">AI priority suggestion</h3>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <PriorityChip priority={priority} />
        <span className="rounded-full bg-white/5 px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-wide text-muted ring-1 ring-white/10">
          {category}
        </span>
        {CATEGORIES.includes(category as (typeof CATEGORIES)[number]) ? null : (
          <span className="text-[11px] text-secondary">({category})</span>
        )}
      </div>
      {suggestion.summary ? (
        <p className="mt-3 text-sm leading-relaxed text-muted">{suggestion.summary}</p>
      ) : null}
      <p className="mt-2 text-[11px] text-secondary">Priority is set automatically from AI when you submit. An agent can adjust it during review.</p>
    </Glass>
  );
}
