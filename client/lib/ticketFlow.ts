import { CATEGORIES, normalizeCategory } from "@/lib/format";
import type { Stats, Ticket } from "@/lib/types";
import {
  isAccepted,
  isCancelled,
  isCompleted,
  isInProgress,
  isNew,
  isPendingWorkerResponse,
  isRejected,
} from "@/lib/ticketStatus";

export function flowCounts(tickets: Ticket[]) {
  const pending = tickets.filter((t) => isNew(t.status)).length;
  const accepted = tickets.filter((t) => isPendingWorkerResponse(t.status)).length;
  const inProgress = tickets.filter((t) => isInProgress(t.status)).length;
  const completed = tickets.filter((t) => isCompleted(t.status)).length;
  const rejected = tickets.filter((t) => isRejected(t.status)).length;
  const cancelled = tickets.filter((t) => isCancelled(t.status)).length;
  const created = tickets.length;
  const fallback = tickets.filter((t) => t.aiFailed).length;
  const workerSuggested = tickets.filter((t) => Boolean(t.assignedAgentId) || Boolean(t.category)).length;
  const workers = new Set(
    tickets.map((t) => t.assignedAgentId).filter((id): id is string => Boolean(id)),
  ).size;

  const categories = CATEGORIES.map((label) => ({
    label,
    count: tickets.filter((t) => (normalizeCategory(t.aiCategory) || normalizeCategory(t.category)) === label).length,
  }));
  const uncategorized = tickets.filter((t) => !normalizeCategory(t.aiCategory) && !normalizeCategory(t.category)).length;

  return {
    created,
    categories,
    uncategorized,
    workers,
    workerSuggested,
    fallback,
    pending,
    accepted,
    rejected,
    inProgress,
    completed,
    cancelled,
  };
}

export function deriveFlowCounts(tickets: Ticket[]): NonNullable<Stats["flowCounts"]> {
  return {
    New: tickets.filter((t) => isNew(t.status)).length,
    PendingWorkerResponse: tickets.filter((t) => isPendingWorkerResponse(t.status)).length,
    Accepted: tickets.filter((t) => isAccepted(t.status)).length,
    InProgress: tickets.filter((t) => isInProgress(t.status)).length,
    Completed: tickets.filter((t) => isCompleted(t.status)).length,
    Rejected: tickets.filter((t) => isRejected(t.status)).length,
    Cancelled: tickets.filter((t) => isCancelled(t.status)).length,
  };
}

export function flowCategoryBreakdown(tickets: Ticket[]) {
  const counts = new Map<string, number>();
  for (const ticket of tickets) {
    const label = normalizeCategory(ticket.category) || normalizeCategory(ticket.aiCategory) || "Uncategorized";
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count);
}
