import type { Role } from "@prisma/client";
import { HttpError } from "./httpError.js";

export type Actor = { sub: string; role: Role };

export function customerScope(actor: Actor) {
  return actor.role === "CUSTOMER" ? { customerId: actor.sub } : {};
}

export function assertCanView(
  actor: Actor,
  ticket: { customerId: string; assignedAgentId?: string | null },
) {
  if (actor.role === "CUSTOMER" && ticket.customerId !== actor.sub) {
    throw new HttpError(404, "Ticket not found");
  }
  if (actor.role === "AGENT" && ticket.assignedAgentId && ticket.assignedAgentId !== actor.sub) {
    throw new HttpError(404, "Ticket not found");
  }
}

export function assertCanMutate(
  actor: Actor,
  ticket: { assignedAgentId: string | null },
  mode: "assigned" | "claim" = "assigned",
) {
  if (actor.role === "ADMIN") return;
  if (actor.role !== "AGENT") {
    throw new HttpError(403, "Forbidden");
  }
  if (mode === "claim") {
    if (ticket.assignedAgentId) {
      throw new HttpError(409, "Ticket is already assigned");
    }
    return;
  }
  if (ticket.assignedAgentId !== actor.sub) {
    throw new HttpError(403, "You can only change tickets assigned to you");
  }
}

export function assertTicketOwner(
  actor: Actor,
  ticket: { customerId: string; assignedAgentId: string | null },
  mode: "view" | "assigned" | "claim",
) {
  if (mode === "view") {
    assertCanView(actor, ticket);
    return;
  }
  assertCanMutate(actor, ticket, mode);
}
