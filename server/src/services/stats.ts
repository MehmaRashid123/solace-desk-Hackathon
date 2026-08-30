import type { Prisma, Role, TicketStatus } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { cacheDel, cacheGet, cacheSet } from "../lib/redis.js";

const STATS_CACHE_TTL_SEC = 60;

const CATEGORIES = ["Billing", "Technical", "Account", "General"] as const;

const STATUS_VALUES: TicketStatus[] = [
  "New",
  "PendingWorkerResponse",
  "Accepted",
  "InProgress",
  "Completed",
  "Rejected",
  "Cancelled",
];

export type StatusFlowCounts = Record<TicketStatus, number>;



export type DashboardStats = {

  highPriorityCount: number;

  highPriorityTrend: number;

  normalPriorityCount: number;

  normalPriorityTrend: number;

  avgResolutionTimeMinutes: number;

  avgResolutionTrend: number;

  categoryBreakdown: { category: string; count: number }[];

  workerResponseRate: { accepted: number; rejected: number };

  flowCounts: StatusFlowCounts;

  ticketsPerDay: { date: string; count: number }[];

  ratingTrend: { date: string; avgRating: number }[];

  myAvgRating?: number;

  myRatingTrend?: { stars: number; createdAt: string }[];

  new: number;

  assigned: number;

  open: number;

  inProgress: number;

  resolved: number;

  high: number;

  total: number;

  assignedToday: number;

  reopened: number;

  resolvedToday: number;

  avgResolutionHours: number;

  priorityMix: { low: number; medium: number; high: number };

  byStatus: Record<string, number>;

  byCategory: Record<string, number>;

  byPriority: Record<string, number>;

};



export function invalidateStatsCache() {
  void cacheDel("stats:*");
}



function normalizeCategory(raw?: string | null) {

  if (!raw) return "";

  return CATEGORIES.find((c) => c.toLowerCase() === raw.trim().toLowerCase()) ?? raw.trim();

}



function pctTrend(thisPeriod: number, lastPeriod: number) {

  if (lastPeriod === 0) return thisPeriod > 0 ? 100 : 0;

  return Math.round(((thisPeriod - lastPeriod) / lastPeriod) * 1000) / 10;

}



function scopeWhere(role: Role, userId: string): Prisma.TicketWhereInput {

  if (role === "CUSTOMER") return { customerId: userId };

  if (role === "AGENT") return { assignedAgentId: userId };

  return {};

}



function localDateKey(value: Date) {

  return value.toISOString().slice(0, 10);

}



function daySeries(days: number, start: Date) {

  const rows: string[] = [];

  for (let i = days - 1; i >= 0; i -= 1) {

    const day = new Date(start);

    day.setDate(start.getDate() - i);

    rows.push(localDateKey(day));

  }

  return rows;

}



function confidenceRating(raw: unknown) {

  if (!raw || typeof raw !== "object") return 4;

  const confidence = (raw as { confidence?: number }).confidence;

  if (typeof confidence === "number" && Number.isFinite(confidence)) {

    return Math.round(Math.min(Math.max(confidence, 0), 1) * 50) / 10;

  }

  return 4;

}



function emptyStatusCounts(): StatusFlowCounts {

  return {

    New: 0,

    PendingWorkerResponse: 0,

    Accepted: 0,

    InProgress: 0,

    Completed: 0,

    Rejected: 0,

    Cancelled: 0,

  };

}



function statusFlowCounts(byStatus: Record<string, number>): StatusFlowCounts {

  const counts = emptyStatusCounts();

  for (const status of STATUS_VALUES) {

    counts[status] = byStatus[status] ?? 0;

  }

  return counts;

}



function computeCategoryBreakdown(

  tickets: { category: string | null; aiCategory: string | null }[],

) {

  const counts = new Map<string, number>();

  for (const ticket of tickets) {

    const label =

      normalizeCategory(ticket.category) ||

      normalizeCategory(ticket.aiCategory) ||

      "Unreviewed";

    counts.set(label, (counts.get(label) ?? 0) + 1);

  }

  return [...counts.entries()]

    .map(([category, count]) => ({ category, count }))

    .sort((a, b) => b.count - a.count);

}



export async function getDashboardStats(role: Role, userId: string): Promise<DashboardStats> {
  const cacheKey = `stats:${role}:${userId}`;
  const hit = await cacheGet<DashboardStats>(cacheKey);
  if (hit) return hit;



  const where = scopeWhere(role, userId);

  const now = new Date();

  const startOfDay = new Date(now);

  startOfDay.setHours(0, 0, 0, 0);

  const thisWeekStart = new Date(now);

  thisWeekStart.setDate(now.getDate() - 7);

  const lastWeekStart = new Date(now);

  lastWeekStart.setDate(now.getDate() - 14);

  const sevenDaysAgo = new Date(startOfDay);

  sevenDaysAgo.setDate(startOfDay.getDate() - 6);

  const thirtyDaysAgo = new Date(startOfDay);

  thirtyDaysAgo.setDate(startOfDay.getDate() - 29);



  const [

    neu,

    assigned,

    inProgress,

    resolved,

    highOpen,

    total,

    assignedToday,

    reopened,

    resolvedToday,

    low,

    medium,

    highAll,

    grouped,

    highThisWeek,

    highLastWeek,

    normalThisWeek,

    normalLastWeek,

    resolvedThisWeek,

    resolvedLastWeek,

    scopedTickets,

    createdLast7,

    ratingTickets,

    workerProfile,

    workerRatings,

  ] = await Promise.all([

    prisma.ticket.count({ where: { ...where, status: "New" } }),

    prisma.ticket.count({ where: { ...where, status: "PendingWorkerResponse" } }),

    prisma.ticket.count({ where: { ...where, status: "InProgress" } }),

    prisma.ticket.count({ where: { ...where, status: "Completed" } }),

    prisma.ticket.count({ where: { ...where, priority: "HIGH", status: { not: "Completed" } } }),

    prisma.ticket.count({ where }),

    prisma.ticketEvent.count({

      where: { type: "ASSIGNED", createdAt: { gte: startOfDay }, ticket: where },

    }),

    prisma.ticketEvent.count({

      where: { type: "REOPENED", ticket: where },

    }),

    prisma.ticketEvent.count({

      where: { type: "STATUS_CHANGE", toValue: "Completed", createdAt: { gte: startOfDay }, ticket: where },

    }),

    prisma.ticket.count({ where: { ...where, priority: "LOW" } }),

    prisma.ticket.count({ where: { ...where, priority: "MEDIUM" } }),

    prisma.ticket.count({ where: { ...where, priority: "HIGH" } }),

    prisma.ticket.groupBy({

      by: ["status", "category", "priority"],

      where,

      _count: { _all: true },

    }),

    prisma.ticket.count({

      where: { ...where, priority: "HIGH", createdAt: { gte: thisWeekStart } },

    }),

    prisma.ticket.count({

      where: { ...where, priority: "HIGH", createdAt: { gte: lastWeekStart, lt: thisWeekStart } },

    }),

    prisma.ticket.count({

      where: {

        ...where,

        priority: { in: ["LOW", "MEDIUM"] },

        createdAt: { gte: thisWeekStart },

      },

    }),

    prisma.ticket.count({

      where: {

        ...where,

        priority: { in: ["LOW", "MEDIUM"] },

        createdAt: { gte: lastWeekStart, lt: thisWeekStart },

      },

    }),

    prisma.ticket.findMany({

      where: { ...where, status: "Completed", updatedAt: { gte: thisWeekStart } },

      select: { createdAt: true, updatedAt: true },

    }),

    prisma.ticket.findMany({

      where: {

        ...where,

        status: "Completed",

        updatedAt: { gte: lastWeekStart, lt: thisWeekStart },

      },

      select: { createdAt: true, updatedAt: true },

    }),

    prisma.ticket.findMany({

      where,

      select: { status: true, category: true, aiCategory: true },

    }),

    prisma.ticket.findMany({

      where: { ...where, createdAt: { gte: sevenDaysAgo } },

      select: { createdAt: true },

    }),

    prisma.ticket.findMany({

      where: {

        ...where,

        status: "Completed",

        updatedAt: { gte: thirtyDaysAgo },

      },

      select: { updatedAt: true, aiConfidenceRaw: true },

    }),

    role === "AGENT"

      ? prisma.user.findUnique({

          where: { id: userId },

          select: { avgRating: true },

        })

      : Promise.resolve(null),

    role === "AGENT"

      ? prisma.workerRating.findMany({

          where: { workerId: userId },

          orderBy: { createdAt: "desc" },

          take: 10,

          select: { stars: true, createdAt: true },

        })

      : Promise.resolve([]),

  ]);



  const resolvedAll = await prisma.ticket.findMany({

    where: { ...where, status: "Completed" },

    select: { createdAt: true, updatedAt: true },

  });



  const resolutionMinutes = resolvedAll.map((t) => (t.updatedAt.getTime() - t.createdAt.getTime()) / 60_000);

  const avgResolutionTimeMinutes = resolutionMinutes.length

    ? Math.round((resolutionMinutes.reduce((a, b) => a + b, 0) / resolutionMinutes.length) * 10) / 10

    : 0;



  const avgFor = (rows: { createdAt: Date; updatedAt: Date }[]) => {

    if (!rows.length) return 0;

    const mins = rows.map((t) => (t.updatedAt.getTime() - t.createdAt.getTime()) / 60_000);

    return mins.reduce((a, b) => a + b, 0) / mins.length;

  };



  const avgResolutionTrend = pctTrend(avgFor(resolvedThisWeek), avgFor(resolvedLastWeek));



  const byStatus: Record<string, number> = emptyStatusCounts();

  const byCategory: Record<string, number> = {};

  const byPriority: Record<string, number> = { LOW: 0, MEDIUM: 0, HIGH: 0 };

  for (const row of grouped) {

    byStatus[row.status] = (byStatus[row.status] ?? 0) + row._count._all;

    const categoryKey = row.category ?? "Unreviewed";

    const priorityKey = row.priority ?? "UNREVIEWED";

    byCategory[categoryKey] = (byCategory[categoryKey] ?? 0) + row._count._all;

    byPriority[priorityKey] = (byPriority[priorityKey] ?? 0) + row._count._all;

  }



  const categoryBreakdown = computeCategoryBreakdown(scopedTickets);

  const flowCounts = statusFlowCounts(byStatus);

  const workerResponseRate = {

    accepted: flowCounts.Accepted,

    rejected: flowCounts.Rejected,

  };



  const ticketsPerDayMap = new Map<string, number>();

  for (const key of daySeries(7, startOfDay)) ticketsPerDayMap.set(key, 0);

  for (const ticket of createdLast7) {

    const key = localDateKey(ticket.createdAt);

    if (ticketsPerDayMap.has(key)) ticketsPerDayMap.set(key, (ticketsPerDayMap.get(key) ?? 0) + 1);

  }

  const ticketsPerDay = [...ticketsPerDayMap.entries()].map(([date, count]) => ({ date, count }));



  const ratingBuckets = new Map<string, { sum: number; count: number }>();

  for (const key of daySeries(30, startOfDay)) ratingBuckets.set(key, { sum: 0, count: 0 });

  for (const ticket of ratingTickets) {

    const key = localDateKey(ticket.updatedAt);

    const bucket = ratingBuckets.get(key);

    if (!bucket) continue;

    bucket.sum += confidenceRating(ticket.aiConfidenceRaw);

    bucket.count += 1;

  }

  const ratingTrend = [...ratingBuckets.entries()].map(([date, bucket]) => ({

    date,

    avgRating: bucket.count ? Math.round((bucket.sum / bucket.count) * 10) / 10 : 0,

  }));



  const normalPriorityCount = (byPriority.LOW ?? 0) + (byPriority.MEDIUM ?? 0);



  const stats: DashboardStats = {

    highPriorityCount: highOpen,

    highPriorityTrend: pctTrend(highThisWeek, highLastWeek),

    normalPriorityCount,

    normalPriorityTrend: pctTrend(normalThisWeek, normalLastWeek),

    avgResolutionTimeMinutes,

    avgResolutionTrend,

    categoryBreakdown,

    workerResponseRate,

    flowCounts,

    ticketsPerDay,

    ratingTrend,

    new: neu,

    assigned,

    open: neu + assigned,

    inProgress,

    resolved,

    high: highOpen,

    total,

    assignedToday,

    reopened,

    resolvedToday,

    avgResolutionHours: Math.round((avgResolutionTimeMinutes / 60) * 10) / 10,

    priorityMix: { low, medium, high: highAll },

    byStatus,

    byCategory,

    byPriority,

  };



  if (role === "AGENT") {

    stats.myAvgRating = workerProfile?.avgRating ?? 0;

    stats.myRatingTrend = [...workerRatings]

      .reverse()

      .map((rating) => ({

        stars: rating.stars,

        createdAt: rating.createdAt.toISOString(),

      }));

  }



  await cacheSet(cacheKey, stats, STATS_CACHE_TTL_SEC);

  return stats;
}

