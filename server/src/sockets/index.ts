import type { Namespace, Socket } from "socket.io";
import { prisma } from "../lib/prisma.js";
import { verifyAccessToken } from "../lib/jwt.js";
import { getIo, rooms } from "../lib/io.js";

type AuthedSocket = Socket & {
  data: { userId: string; role: string; name: string };
};

function authenticate(socket: Socket, next: (err?: Error) => void) {
  try {
    const token = socket.handshake.auth?.token as string | undefined;
    if (!token) {
      next(new Error("Unauthorized"));
      return;
    }
    const payload = verifyAccessToken(token);
    socket.data.userId = payload.sub;
    socket.data.role = payload.role;
    socket.data.name = payload.name;
    next();
  } catch {
    next(new Error("Unauthorized"));
  }
}

function canJoinTicket(
  role: string,
  userId: string,
  ticket: { customerId: string; assignedAgentId: string | null },
) {
  if (role === "ADMIN") return true;
  if (role === "CUSTOMER") return ticket.customerId === userId;
  if (role === "AGENT") return !ticket.assignedAgentId || ticket.assignedAgentId === userId;
  return false;
}

export function attachSockets() {
  const server = getIo();
  if (!server) return;
  const nsp: Namespace = server.of("/tickets");
  nsp.use(authenticate);

  nsp.on("connection", async (socket: AuthedSocket) => {
    if (socket.data.role === "AGENT" || socket.data.role === "ADMIN") {
      await socket.join(rooms.user(socket.data.userId));
    }

    socket.on("dashboard:join", async () => {
      if (socket.data.role === "AGENT") {
        await socket.join(rooms.dashboard);
      } else if (socket.data.role === "ADMIN") {
        await socket.join(rooms.admin);
      }
    });

    socket.on("dashboard:leave", async () => {
      await socket.leave(rooms.dashboard);
    });

    socket.on("ticket:join", async (ticketId: string) => {
      if (typeof ticketId !== "string") return;
      const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
      if (!ticket) return;
      if (!canJoinTicket(socket.data.role, socket.data.userId, ticket)) return;
      await socket.join(rooms.ticket(ticketId));
    });

    socket.on("ticket:leave", async (ticketId: string) => {
      if (typeof ticketId !== "string") return;
      await socket.leave(rooms.ticket(ticketId));
    });

    socket.on("typing", (payload: { ticketId?: string; typing?: boolean }) => {
      if (!payload?.ticketId) return;
      if (!socket.rooms.has(rooms.ticket(payload.ticketId))) return;
      socket.to(rooms.ticket(payload.ticketId)).emit("typing", {
        ticketId: payload.ticketId,
        userId: socket.data.userId,
        name: socket.data.name,
        typing: Boolean(payload.typing),
      });
    });
  });
}
