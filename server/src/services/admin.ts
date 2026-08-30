import { prisma } from "../lib/prisma.js";
import { ticketInclude } from "./tickets.js";
import { getWorkerProfile, getWorkerReviews, listWorkerProfiles } from "./workers.js";

export async function getAdminOverview() {
  const [workers, customerQueries, stats] = await Promise.all([
    listWorkerProfiles(undefined, { all: true }),    prisma.ticket.findMany({
      where: {
        OR: [{ status: "New", assignedAgentId: null }, { status: "PendingWorkerResponse" }],
      },
      include: ticketInclude,
      orderBy: { updatedAt: "desc" },
      take: 30,
    }),
    Promise.all([
      prisma.ticket.count({ where: { status: "New", assignedAgentId: null } }),
      prisma.ticket.count({ where: { status: "PendingWorkerResponse" } }),
      prisma.ticket.count({ where: { status: { in: ["Accepted", "InProgress"] } } }),
      prisma.ticket.count({ where: { status: "Completed" } }),
      prisma.user.count({ where: { role: "AGENT", isAvailable: true } }),
      prisma.user.count({ where: { role: "AGENT" } }),
    ]),
  ]);

  const [newQueries, pendingSelection, activeTickets, completedTickets, availableWorkers, totalWorkers] = stats;

  return {
    workers,
    customerQueries,
    summary: {
      newQueries,
      pendingSelection,
      activeTickets,
      completedTickets,
      availableWorkers,
      totalWorkers,
    },
  };
}

export async function getAdminWorkers() {
  const workers = await listWorkerProfiles(undefined, { all: true });
  return { workers };
}

export async function getAdminWorkerDetail(workerId: string) {
  const worker = await getWorkerProfile(workerId);
  if (!worker) return null;

  const [reviews, tickets] = await Promise.all([
    getWorkerReviews(workerId, 20),
    prisma.ticket.findMany({
      where: { assignedAgentId: workerId },
      include: ticketInclude,
      orderBy: { updatedAt: "desc" },
      take: 50,
    }),
  ]);

  return { worker, reviews, tickets };
}