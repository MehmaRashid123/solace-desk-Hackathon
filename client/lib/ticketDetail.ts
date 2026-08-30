import { normalizeCategory, normalizePriority } from "@/lib/format";
import { isAccepted, isCompleted, isInProgress, isNew, isRejected, normalizeEventStatus } from "@/lib/ticketStatus";
import type { Ticket, TicketEvent } from "@/lib/types";
import type { TimelineEvent, TimelineEventType } from "@/components/TicketTimeline";

export type TimelineStep = {
  key: string;
  label: string;
  at: string | null;
  done: boolean;
  color: string;
};

function inferEventType(event: TicketEvent): TimelineEventType {
  if (event.type === "ASSIGNED") return "assignment";
  if (event.type === "REOPENED") return "status";
  if (event.type === "STATUS_CHANGE") {
    const next = normalizeEventStatus(event.toValue);
    if (next === "Rejected") return "rejection";
    if (next === "Completed") return "completion";
    return "status";
  }
  return "other";
}

function ticketEventToTimeline(event: TicketEvent, label: string): TimelineEvent {
  return {
    type: inferEventType(event),
    label,
    timestamp: event.createdAt,
  };
}

export function buildTimelineEvents(ticket: Ticket): TimelineEvent[] {
  const events: TimelineEvent[] = [
    { type: "creation", label: "Created", timestamp: ticket.createdAt },
  ];

  if (ticket.aiCategory || ticket.aiPriority || ticket.aiSummary || ticket.aiFailed) {
    events.push({
      type: "ai",
      label: ticket.aiFailed ? "AI fallback" : "AI triage",
      timestamp: ticket.createdAt,
    });
  }

  const sorted = [...(ticket.events ?? [])].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );

  for (const event of sorted) {
    events.push(ticketEventToTimeline(event, eventTimelineLabel(event)));
  }

  return events;
}

function eventAt(events: TicketEvent[] | undefined, match: (event: TicketEvent) => boolean) {
  return events?.find(match)?.createdAt ?? null;
}

export function eventTimelineLabel(event: TicketEvent) {
  if (event.type === "ASSIGNED") return "Worker selected";
  if (event.type === "REOPENED") return "Reopened";
  if (event.type === "STATUS_CHANGE") {
    const next = normalizeEventStatus(event.toValue);
    const readable = next.replace(/([a-z])([A-Z])/g, "$1 $2");
    return readable.length > 18 ? `${readable.slice(0, 18)}…` : readable;
  }
  return "Updated";
}

export function eventTimelineColor(event: TicketEvent) {
  const next = normalizeEventStatus(event.toValue);
  if (event.type === "ASSIGNED") return "#FBBF24";
  if (event.type === "REOPENED") return "#EF4444";
  if (next === "Completed") return "#22C55E";
  if (next === "InProgress") return "#38BDF8";
  if (next === "Accepted") return "#22C55E";
  if (next === "Rejected") return "#EF4444";
  return "#8B5CF6";
}

export function buildEventTimeline(ticket: Ticket): TimelineStep[] {
  const created: TimelineStep = {
    key: "created",
    label: "Created",
    at: ticket.createdAt,
    done: true,
    color: "#FF5722",
  };
  const eventSteps = [...(ticket.events ?? [])]
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    .map((event) => ({
      key: event.id,
      label: eventTimelineLabel(event),
      at: event.createdAt,
      done: true,
      color: eventTimelineColor(event),
    }));
  return [created, ...eventSteps];
}

export function buildTimeline(ticket: Ticket): TimelineStep[] {
  const events = ticket.events ?? [];
  const assignedAt = eventAt(events, (e) => e.type === "ASSIGNED");
  const acceptedAt = eventAt(
    events,
    (e) => e.type === "STATUS_CHANGE" && normalizeEventStatus(e.toValue) === "Accepted",
  );
  const progressAt = eventAt(
    events,
    (e) => e.type === "STATUS_CHANGE" && normalizeEventStatus(e.toValue) === "InProgress",
  );
  const completedAt = eventAt(
    events,
    (e) => e.type === "STATUS_CHANGE" && normalizeEventStatus(e.toValue) === "Completed",
  );
  const reopenedAt = eventAt(events, (e) => e.type === "REOPENED");
  const aiDone = Boolean(ticket.aiCategory || ticket.aiPriority || ticket.aiSummary || ticket.aiFailed);

  const steps: TimelineStep[] = [
    { key: "created", label: "Created", at: ticket.createdAt, done: true, color: "#FF5722" },
    {
      key: "ai",
      label: ticket.aiFailed ? "AI fallback" : "AI Suggested",
      at: aiDone ? ticket.createdAt : null,
      done: aiDone,
      color: "#8B5CF6",
    },
    {
      key: "worker",
      label: "Worker Selected",
      at: assignedAt,
      done: Boolean(ticket.assignedAgentId),
      color: "#FBBF24",
    },
    {
      key: "accepted",
      label: "Accepted",
      at: acceptedAt ?? assignedAt,
      done: isAccepted(ticket.status) || isInProgress(ticket.status) || isCompleted(ticket.status),
      color: "#22C55E",
    },
    {
      key: "progress",
      label: "In Progress",
      at: progressAt,
      done: isInProgress(ticket.status) || isCompleted(ticket.status),
      color: "#38BDF8",
    },
    {
      key: "completed",
      label: "Completed",
      at: completedAt,
      done: isCompleted(ticket.status),
      color: "#22C55E",
    },
  ];

  if (reopenedAt) {
    steps.push({ key: "reopened", label: "Reopened", at: reopenedAt, done: true, color: "#EF4444" });
  }

  if (isRejected(ticket.status)) {
    steps.push({ key: "rejected", label: "Rejected", at: ticket.updatedAt, done: true, color: "#EF4444" });
  }

  return steps;
}

export function aiConfidence(ticket: Ticket): { pct: number | null; label: string } {
  const raw = ticket.aiConfidenceRaw as { failed?: boolean; source?: string } | null;
  if (ticket.aiFailed || raw?.failed) return { pct: null, label: "AI failed" };
  const fields = [normalizeCategory(ticket.aiCategory), normalizePriority(ticket.aiPriority), ticket.aiSummary?.trim()].filter(Boolean).length;
  if (!fields) return { pct: null, label: "Pending" };
  const base = raw?.source === "fallback" ? 40 : raw?.source === "anthropic" || raw?.source === "openai" ? 70 : 55;
  return { pct: Math.min(base + fields * 8, 94), label: raw?.source ? raw.source : "Match" };
}

function localKey(value: Date | string) {
  const day = typeof value === "string" ? new Date(value) : value;
  return `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;
}

export function dayBuckets(tickets: Ticket[], days: number) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (days - 1));
  return Array.from({ length: days }, (_, i) => {
    const day = new Date(start);
    day.setDate(start.getDate() + i);
    const key = localKey(day);
    const count = tickets.filter((t) => localKey(t.createdAt) === key).length;
    const resolvedHours = tickets
      .filter((t) => isCompleted(t.status) && localKey(t.updatedAt) === key)
      .map((t) => Math.max((new Date(t.updatedAt).getTime() - new Date(t.createdAt).getTime()) / 3_600_000, 0));
    const avgHours = resolvedHours.length ? resolvedHours.reduce((a, b) => a + b, 0) / resolvedHours.length : 0;
    return {
      key,
      label: day.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      count,
      avgHours,
    };
  });
}

export function pctChange(current: number, previous: number) {
  if (!previous && !current) return 0;
  if (!previous) return 100;
  return Math.round(((current - previous) / previous) * 100);
}
