import type { Namespace, Server } from "socket.io";

const TICKETS_NS = "/tickets";

let io: Server | null = null;

export function setIo(server: Server) {
  io = server;
}

export function getIo() {
  return io;
}

export function ticketsNsp(): Namespace | null {
  return io?.of(TICKETS_NS) ?? null;
}

export const rooms = {
  ticket: (id: string) => `ticket:${id}`,
  dashboard: "agent:dashboard",
  admin: "admin:dashboard",
  user: (id: string) => `user:${id}`,
};

function emitToTicketAndDashboard(event: string, ticket: { id: string }) {
  const nsp = ticketsNsp();
  if (!nsp) return;
  nsp.to(rooms.ticket(ticket.id)).emit(event, ticket);
  nsp.to(rooms.dashboard).emit(event, ticket);
}

export function emitMessageNew(ticketId: string, payload: unknown) {
  ticketsNsp()?.to(rooms.ticket(ticketId)).emit("message:new", payload);
}

export function emitStatusChanged(ticket: { id: string }) {
  emitToTicketAndDashboard("ticket:statusChanged", ticket);
}

export function emitAssigned(ticket: { id: string }) {
  emitToTicketAndDashboard("ticket:assigned", ticket);
}

export function emitWorkerNewBooking(workerId: string, ticket: unknown) {
  ticketsNsp()?.to(rooms.user(workerId)).emit("worker:newBooking", ticket);
}

/** Customer selected a worker — notify only that worker + admins, plus ticket room for customer UI. */
export function emitWorkerSelected(workerId: string, ticket: { id: string }) {
  const nsp = ticketsNsp();
  if (!nsp) return;
  nsp.to(rooms.ticket(ticket.id)).emit("ticket:statusChanged", ticket);
  nsp.to(rooms.user(workerId)).emit("worker:newBooking", ticket);
  nsp.to(rooms.admin).emit("admin:workerSelected", ticket);
}

export function emitWorkerResponded(ticket: { id: string }) {
  emitToTicketAndDashboard("ticket:workerResponded", ticket);
}

export function emitRatingSubmitted(ticketId: string, payload: unknown) {
  const nsp = ticketsNsp();
  if (!nsp) return;
  nsp.to(rooms.ticket(ticketId)).emit("rating:submitted", payload);
  nsp.to(rooms.dashboard).emit("rating:submitted", payload);
}
