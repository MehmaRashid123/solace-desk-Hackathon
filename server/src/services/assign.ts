import { prisma } from "../lib/prisma.js";
import { parseOfficialCategory } from "../lib/taxonomy.js";
import { ticketInclude } from "./tickets.js";

async function loadWithRelations(ticketId: string) {
  return prisma.ticket.findUniqueOrThrow({ where: { id: ticketId }, include: ticketInclude });
}

export async function autoAssignByCategory(ticketId: string) {
  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
  if (!ticket || ticket.assignedAgentId) return loadWithRelations(ticketId);

  const routingCategory = parseOfficialCategory(ticket.category ?? "");
  if (!routingCategory) return loadWithRelations(ticketId);

  const agents = await prisma.user.findMany({
    where: { role: "AGENT" },
    orderBy: { createdAt: "asc" },
  });
  if (agents.length === 0) return loadWithRelations(ticketId);

  return prisma.$transaction(async (tx) => {
    const cursor = await tx.assignmentCursor.upsert({
      where: { category: routingCategory },
      create: { category: routingCategory, lastAgentId: null },
      update: {},
    });
    const lastIndex = agents.findIndex((agent) => agent.id === cursor.lastAgentId);
    const next = agents[(lastIndex + 1) % agents.length];

    await tx.assignmentCursor.update({
      where: { category: routingCategory },
      data: { lastAgentId: next.id },
    });

    const assigned = await tx.ticket.update({
      where: { id: ticketId },
      data: {
        assignedAgentId: next.id,
        status: "PendingWorkerResponse",
      },
      include: ticketInclude,
    });

    await tx.ticketEvent.create({
      data: { ticketId, type: "ASSIGNED", fromValue: null, toValue: next.id, actorId: next.id },
    });
    await tx.ticketEvent.create({
      data: { ticketId, type: "STATUS_CHANGE", fromValue: "New", toValue: "PendingWorkerResponse", actorId: next.id },
    });

    return assigned;
  });
}
