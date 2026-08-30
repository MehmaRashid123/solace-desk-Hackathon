import { prisma } from "../lib/prisma.js";
import { type Actor } from "../lib/ticketAccess.js";
import {
  addMessage,
  changeTicketStatus,
  createTicket,
  getTicket,
  listTickets,
} from "../services/tickets.js";
import { runInternalTriage } from "../services/triage.js";
import { getDashboardStats, invalidateStatsCache } from "../services/stats.js";
import { getQueueMetrics } from "../services/queue.js";
import type { TicketPriority, TicketStatus } from "@prisma/client";

export type GraphQLContext = {
  actor: Actor | null;
};

export const rootResolver = {
  me: async (_args: unknown, context: GraphQLContext) => {
    if (!context.actor) return null;
    return prisma.user.findUnique({ where: { id: context.actor.sub } });
  },

  tickets: async (
    args: { status?: TicketStatus; priority?: TicketPriority; category?: string; mine?: boolean },
    context: GraphQLContext,
  ) => {
    if (!context.actor) throw new Error("Unauthorized: Please provide Authorization Bearer token");
    const tickets = await listTickets(context.actor, {
      status: args.status,
      priority: args.priority,
      category: args.category,
      mine: args.mine,
    });
    return tickets.map((t) => ({
      ...t,
      createdAt: t.createdAt.toISOString(),
      updatedAt: t.updatedAt.toISOString(),
    }));
  },

  ticket: async (args: { id: string }, context: GraphQLContext) => {
    if (!context.actor) throw new Error("Unauthorized: Please provide Authorization Bearer token");
    const ticket = await getTicket(context.actor, args.id);
    return {
      ...ticket,
      createdAt: ticket.createdAt.toISOString(),
      updatedAt: ticket.updatedAt.toISOString(),
      messages: ticket.messages?.map((m) => ({
        ...m,
        createdAt: m.createdAt.toISOString(),
      })),
      events: ticket.events?.map((e) => ({
        ...e,
        createdAt: e.createdAt.toISOString(),
      })),
    };
  },

  workers: async () => {
    return prisma.user.findMany({
      where: { role: "AGENT" },
      orderBy: { avgRating: "desc" },
    });
  },

  stats: async (_args: unknown, context: GraphQLContext) => {
    if (!context.actor) throw new Error("Unauthorized: Please provide Authorization Bearer token");
    return getDashboardStats(context.actor.role, context.actor.sub);
  },

  queueStatus: () => {
    return getQueueMetrics();
  },

  createTicket: async (
    args: { subject: string; description: string; category?: string },
    context: GraphQLContext,
  ) => {
    if (!context.actor) throw new Error("Unauthorized: Please provide Authorization Bearer token");
    const ticket = await createTicket(context.actor, {
      subject: args.subject,
      description: args.description,
      category: args.category,
    });
    let result = ticket;
    try {
      result = (await runInternalTriage(ticket.id)) ?? ticket;
    } catch {
      // Non-blocking
    }
    invalidateStatsCache();
    return {
      ...result,
      createdAt: result.createdAt.toISOString(),
      updatedAt: result.updatedAt.toISOString(),
    };
  },

  addMessage: async (
    args: { ticketId: string; body: string },
    context: GraphQLContext,
  ) => {
    if (!context.actor) throw new Error("Unauthorized: Please provide Authorization Bearer token");
    const message = await addMessage(context.actor, args.ticketId, args.body);
    return {
      ...message,
      createdAt: message.createdAt.toISOString(),
    };
  },

  changeTicketStatus: async (
    args: { ticketId: string; status: TicketStatus; resolutionNote?: string },
    context: GraphQLContext,
  ) => {
    if (!context.actor) throw new Error("Unauthorized: Please provide Authorization Bearer token");
    const { ticket } = await changeTicketStatus(
      context.actor,
      args.ticketId,
      args.status,
      args.resolutionNote,
    );
    invalidateStatsCache();
    return {
      ...ticket,
      createdAt: ticket.createdAt.toISOString(),
      updatedAt: ticket.updatedAt.toISOString(),
    };
  },
};
