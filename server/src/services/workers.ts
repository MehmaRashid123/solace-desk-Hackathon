import { prisma } from "../lib/prisma.js";

export type WorkerReview = {
  stars: number;
  comment: string | null;
  customerName: string;
  createdAt: string;
};

export type WorkerProfile = {
  id: string;
  name: string;
  email: string;
  avatarHue: number;
  category: string | null;
  avgRating: number;
  ratingCount: number;
  isAvailable: boolean;
  activeTickets: number;
  completedTickets: number;
  replyCount: number;
  recentReviews: WorkerReview[];
};

const ACTIVE_STATUSES = ["PendingWorkerResponse", "Accepted", "InProgress"] as const;

async function loadWorkerStats(workerId: string) {
  const [activeTickets, completedTickets, replyCount, recentReviews] = await Promise.all([
    prisma.ticket.count({
      where: { assignedAgentId: workerId, status: { in: [...ACTIVE_STATUSES] } },
    }),
    prisma.ticket.count({
      where: { assignedAgentId: workerId, status: "Completed" },
    }),
    prisma.message.count({
      where: { senderId: workerId, senderRole: "AGENT" },
    }),
    prisma.workerRating.findMany({
      where: { workerId },
      orderBy: { createdAt: "desc" },
      take: 3,
      include: { customer: { select: { name: true } } },
    }),
  ]);

  return {
    activeTickets,
    completedTickets,
    replyCount,
    recentReviews: recentReviews.map((r) => ({
      stars: r.stars,
      comment: r.comment,
      customerName: r.customer.name,
      createdAt: r.createdAt.toISOString(),
    })),
  };
}

export async function suggestWorkers(category: string): Promise<string[]> {
  const normalized = category.trim();
  const byCategory = await prisma.user.findMany({
    where: {
      role: "AGENT",
      isAvailable: true,
      category: normalized || undefined,
    },
    orderBy: [{ avgRating: "desc" }, { ratingCount: "desc" }],
    take: 5,
    select: { id: true },
  });

  if (byCategory.length > 0) {
    return byCategory.map((worker) => worker.id);
  }

  const fallback = await prisma.user.findMany({
    where: { role: "AGENT", isAvailable: true },
    orderBy: [{ avgRating: "desc" }, { ratingCount: "desc" }],
    take: 5,
    select: { id: true },
  });

  return fallback.map((worker) => worker.id);
}

export async function listWorkerProfiles(ids?: string[], opts?: { all?: boolean }): Promise<WorkerProfile[]> {
  const agents = await prisma.user.findMany({
    where: {
      role: "AGENT",
      ...(ids?.length ? { id: { in: ids } } : opts?.all ? {} : { isAvailable: true }),
    },
    orderBy: [{ avgRating: "desc" }, { ratingCount: "desc" }],
    select: {
      id: true,
      name: true,
      email: true,
      avatarHue: true,
      category: true,
      avgRating: true,
      ratingCount: true,
      isAvailable: true,
    },
  });

  return Promise.all(
    agents.map(async (agent) => {
      const stats = await loadWorkerStats(agent.id);
      return { ...agent, ...stats };
    }),
  );
}

export async function getWorkerProfile(workerId: string): Promise<WorkerProfile | null> {
  const agent = await prisma.user.findFirst({
    where: { id: workerId, role: "AGENT" },
    select: {
      id: true,
      name: true,
      email: true,
      avatarHue: true,
      category: true,
      avgRating: true,
      ratingCount: true,
      isAvailable: true,
    },
  });
  if (!agent) return null;
  const stats = await loadWorkerStats(agent.id);
  return { ...agent, ...stats };
}

export async function getWorkerReviews(workerId: string, limit = 10): Promise<WorkerReview[]> {
  const rows = await prisma.workerRating.findMany({
    where: { workerId },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { customer: { select: { name: true } } },
  });
  return rows.map((r) => ({
    stars: r.stars,
    comment: r.comment,
    customerName: r.customer.name,
    createdAt: r.createdAt.toISOString(),
  }));
}
