import { normalizeCategory } from "@/lib/format";
import type { Ticket } from "@/lib/types";

export function bookingSummary(ticket: Ticket) {
  const category = normalizeCategory(ticket.aiCategory) || normalizeCategory(ticket.category) || "General";
  return `Customer needs: ${category} — ${ticket.subject}`;
}
