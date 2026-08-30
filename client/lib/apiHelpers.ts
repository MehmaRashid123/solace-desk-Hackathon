import type { Ticket } from "@/lib/types";

export function unwrapTicketPayload(data: unknown, label = "ticket"): Ticket {
  if (!data || typeof data !== "object") {
    throw new Error(`Invalid server response (${label})`);
  }
  const record = data as Record<string, unknown>;
  const nested = record.ticket;
  if (nested && typeof nested === "object" && "id" in nested) {
    return nested as Ticket;
  }
  if ("id" in record && "ticketNumber" in record) {
    return record as Ticket;
  }
  throw new Error(`Server did not return a ${label}`);
}

export function unwrapTicketList(data: unknown): Ticket[] {
  if (!data || typeof data !== "object") return [];
  const record = data as Record<string, unknown>;
  const list = record.tickets;
  return Array.isArray(list) ? (list.filter(Boolean) as Ticket[]) : [];
}
