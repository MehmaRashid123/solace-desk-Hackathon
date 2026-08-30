import type { TicketStatus } from "@prisma/client";

export const TERMINAL_STATUSES: TicketStatus[] = ["Rejected", "Cancelled", "Completed"];

export function isTerminalStatus(status: TicketStatus) {
  return TERMINAL_STATUSES.includes(status);
}
