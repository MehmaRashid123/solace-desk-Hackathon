import type { TicketStatus } from "@/lib/types";

export function relativeTime(value: string) {
  const delta = Date.now() - new Date(value).getTime();
  const minutes = Math.round(delta / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

export const CATEGORIES = ["Billing", "Technical", "Account", "General"] as const;

export function normalizeCategory(raw?: string | null) {
  if (!raw) return "";
  return CATEGORIES.find((c) => c.toLowerCase() === raw.trim().toLowerCase()) ?? "";
}

export const CUSTOMER_STATUS: Record<TicketStatus, string> = {
  New: "Waiting",
  PendingWorkerResponse: "Pending worker",
  Accepted: "Accepted",
  InProgress: "In progress",
  Completed: "Completed",
  Rejected: "Rejected",
  Cancelled: "Cancelled",
};

export function statusLabel(status: TicketStatus, forCustomer = false) {
  if (forCustomer) return CUSTOMER_STATUS[status];
  return status.replace(/([a-z])([A-Z])/g, "$1 $2");
}

export function formatStamp(value: string) {
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function normalizePriority(raw?: string | null): "LOW" | "MEDIUM" | "HIGH" | "" {
  if (!raw) return "";
  const value = raw.trim().toUpperCase();
  if (value === "LOW" || value === "MEDIUM" || value === "HIGH") return value;
  return "";
}
