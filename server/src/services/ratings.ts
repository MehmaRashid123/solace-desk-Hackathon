import { prisma } from "../lib/prisma.js";
import { HttpError } from "../lib/httpError.js";
import type { Actor } from "../lib/ticketAccess.js";
import { invalidateStatsCache } from "./stats.js";
import { ticketInclude } from "./tickets.js";

export async function submitWorkerRating(
  actor: Actor,
  ticketId: string,
  input: { stars: number; comment?: string },
) {
  if (actor.role !== "CUSTOMER") {
    throw new HttpError(403, "Forbidden");
  }

  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
  if (!ticket || ticket.customerId !== actor.sub) {
    throw new HttpError(404, "Ticket not found");
  }
  if (ticket.status !== "Completed") {
    throw new HttpError(409, "Only completed tickets can be rated");
  }
  if (!ticket.assignedAgentId) {
    throw new HttpError(409, "Ticket has no assigned worker to rate");
  }

  const existing = await prisma.workerRating.findUnique({ where: { ticketId } });
  if (existing) {
    throw new HttpError(409, "This ticket has already been rated");
  }

  const comment = input.comment?.trim() || null;

  return prisma.$transaction(async (tx) => {
    const rating = await tx.workerRating.create({
      data: {
        ticketId,
        workerId: ticket.assignedAgentId!,
        customerId: actor.sub,
        stars: input.stars,
        comment,
      },
    });

    const worker = await tx.user.findUniqueOrThrow({ where: { id: ticket.assignedAgentId! } });
    const nextCount = worker.ratingCount + 1;
    const nextAvg = (worker.avgRating * worker.ratingCount + input.stars) / nextCount;

    await tx.user.update({
      where: { id: worker.id },
      data: {
        ratingCount: nextCount,
        avgRating: Math.round(nextAvg * 100) / 100,
      },
    });

    const updatedTicket = await tx.ticket.findUniqueOrThrow({
      where: { id: ticketId },
      include: ticketInclude,
    });

    return { rating, ticket: updatedTicket, workerId: worker.id };
  }).then((result) => {
    invalidateStatsCache();
    return result;
  });
}
