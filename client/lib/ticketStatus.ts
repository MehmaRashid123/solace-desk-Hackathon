import type { TicketStatus } from "@/lib/types";

export const ALL_TICKET_STATUSES: TicketStatus[] = [
  "New",
  "PendingWorkerResponse",
  "Accepted",
  "InProgress",
  "Completed",
  "Rejected",
  "Cancelled",
];

export const STATUS_FILTER_OPTIONS: Array<TicketStatus | "ALL"> = ["ALL", ...ALL_TICKET_STATUSES];

export const KANBAN_COLUMNS: TicketStatus[] = ["New", "PendingWorkerResponse", "InProgress", "Completed"];

export function isNew(status: TicketStatus) {
  return status === "New";
}

export function isPendingWorkerResponse(status: TicketStatus) {
  return status === "PendingWorkerResponse";
}

export function isAccepted(status: TicketStatus) {
  return status === "Accepted";
}

export function isInProgress(status: TicketStatus) {
  return status === "InProgress";
}

export function isCompleted(status: TicketStatus) {
  return status === "Completed";
}

export function isRejected(status: TicketStatus) {
  return status === "Rejected";
}

export function isCancelled(status: TicketStatus) {
  return status === "Cancelled";
}

export function isActiveForWorker(status: TicketStatus) {
  return isAccepted(status) || isInProgress(status);
}

export function isTerminal(status: TicketStatus) {
  return isCompleted(status) || isRejected(status) || isCancelled(status);
}

export function isOpenForCustomer(status: TicketStatus) {
  return isNew(status) || isPendingWorkerResponse(status) || isAccepted(status);
}

export function isWithAgent(status: TicketStatus) {
  return isAccepted(status) || isInProgress(status);
}

/** Maps legacy event toValue strings to readable labels (events may predate enum migration). */
export function normalizeEventStatus(value: string | null | undefined) {
  if (!value) return "";
  const legacy: Record<string, TicketStatus> = {
    NEW: "New",
    ASSIGNED: "Accepted",
    IN_PROGRESS: "InProgress",
    RESOLVED: "Completed",
  };
  return legacy[value] ?? value;
}
