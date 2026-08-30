import type { Ticket } from "./types";

function lastNDates(days: number) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  return Array.from({ length: days }, (_, index) => {
    const day = new Date(start);
    day.setDate(start.getDate() - (days - 1 - index));
    return day.toISOString().slice(0, 10);
  });
}

function dayKey(value: string | Date) {
  return new Date(value).toISOString().slice(0, 10);
}

export function sparklineFromDailyCounts(rows: { date: string; count: number }[] | undefined, days = 7) {
  const keys = lastNDates(days);
  const map = new Map((rows ?? []).map((row) => [row.date, row.count]));
  return keys.map((key) => map.get(key) ?? 0);
}

export function prioritySparkline(tickets: Ticket[], mode: "HIGH" | "NORMAL", days = 7) {
  const keys = lastNDates(days);
  return keys.map((key) =>
    tickets.filter((ticket) => {
      if (dayKey(ticket.createdAt) !== key) return false;
      if (mode === "HIGH") return ticket.priority === "HIGH";
      return ticket.priority === "LOW" || ticket.priority === "MEDIUM";
    }).length,
  );
}

export function resolutionSparkline(tickets: Ticket[], days = 7) {
  const keys = lastNDates(days);
  return keys.map((key) => {
    const resolved = tickets.filter((ticket) => ticket.status === "Completed" && dayKey(ticket.updatedAt) === key);
    if (!resolved.length) return 0;
    const minutes = resolved.map(
      (ticket) => (new Date(ticket.updatedAt).getTime() - new Date(ticket.createdAt).getTime()) / 60_000,
    );
    return Math.round(minutes.reduce((sum, value) => sum + value, 0) / minutes.length);
  });
}

export function formatResolutionMinutes(minutes: number) {
  const hourPart = Math.floor(minutes / 60);
  const minPart = Math.round(minutes % 60);
  if (hourPart <= 0) return `${minPart}m`;
  return `${hourPart}h ${String(minPart).padStart(2, "0")}m`;
}

const CATEGORY_COLORS: Record<string, string> = {
  Billing: "#FF5722",
  Technical: "#8B5CF6",
  Account: "#38BDF8",
  General: "#FBBF24",
  Unreviewed: "#6B7280",
};

const FALLBACK_CATEGORY_COLORS = ["#FF5722", "#8B5CF6", "#38BDF8", "#FBBF24", "#6B7280"];

export function categoryDonutSegments(
  breakdown: { category: string; count: number }[] | undefined,
  tickets: Ticket[],
) {
  if (breakdown?.length) {
    return breakdown.slice(0, 5).map((row, index) => ({
      label: row.category,
      value: row.count,
      color: CATEGORY_COLORS[row.category] ?? FALLBACK_CATEGORY_COLORS[index % FALLBACK_CATEGORY_COLORS.length],
    }));
  }

  const counts = new Map<string, number>();
  for (const ticket of tickets) {
    const label = ticket.category?.trim() || "Unreviewed";
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([label, value], index) => ({
      label,
      value,
      color: CATEGORY_COLORS[label] ?? FALLBACK_CATEGORY_COLORS[index % FALLBACK_CATEGORY_COLORS.length],
    }));
}

export function workerResponseSegments(rate?: { accepted: number; rejected: number }) {
  return [
    { label: "Accepted", value: rate?.accepted ?? 0, color: "#22C55E" },
    { label: "Rejected", value: rate?.rejected ?? 0, color: "#EF4444" },
  ];
}
