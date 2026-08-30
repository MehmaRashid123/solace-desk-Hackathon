import type { Dispatch, SetStateAction } from "react";
import type { Socket } from "socket.io-client";
import type { Ticket } from "./types";
import { mergeTicketUpdate } from "./mergeTicket";

export function upsertTicket(prev: Ticket[], ticket: Ticket) {
  if (!ticket?.id) return prev;
  const i = prev.findIndex((t) => t.id === ticket.id);
  if (i === -1) return [ticket, ...prev];
  const next = [...prev];
  next[i] = mergeTicketUpdate(next[i], ticket);
  return next;
}

export function isAssignedOrClaimable(ticket: Ticket, userId: string) {
  return !ticket.assignedAgentId || ticket.assignedAgentId === userId;
}

export function listenTicketList(
  socket: Socket,
  setTickets: Dispatch<SetStateAction<Ticket[]>>,
  options?: { filter?: (ticket: Ticket) => boolean },
) {
  const onChange = (ticket: Ticket) => {
    if (!ticket?.id) return;
    setTickets((prev) => {
      if (options?.filter && !options.filter(ticket)) {
        return prev.filter((row) => row.id !== ticket.id);
      }
      return upsertTicket(prev, ticket);
    });
  };
  socket.on("ticket:statusChanged", onChange);
  socket.on("ticket:assigned", onChange);
  return () => {
    socket.off("ticket:statusChanged", onChange);
    socket.off("ticket:assigned", onChange);
  };
}
