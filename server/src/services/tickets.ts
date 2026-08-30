import type { Prisma, TicketPriority, TicketStatus } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { HttpError } from "../lib/httpError.js";
import { isTerminalStatus } from "../lib/ticketStatus.js";
import { assertCanMutate, assertCanView, customerScope, type Actor } from "../lib/ticketAccess.js";
import { parseOfficialCategory } from "../lib/taxonomy.js";
import { suggestWorkers } from "./workers.js";

export const ticketInclude = {
  customer: { select: { id: true, name: true, email: true, role: true, avatarHue: true, createdAt: true } },
  assignedAgent: { select: { id: true, name: true, email: true, role: true, avatarHue: true, createdAt: true } },
  workerRating: { select: { id: true, stars: true, comment: true } },
  _count: { select: { messages: true } },
} satisfies Prisma.TicketInclude;

export const ticketDetailInclude = {
  ...ticketInclude,
  messages: {
    orderBy: { createdAt: "asc" as const },
    include: {
      sender: { select: { id: true, name: true, email: true, role: true, avatarHue: true, createdAt: true } },
    },
  },
  events: {
    orderBy: { createdAt: "asc" as const },
    include: {
      actor: { select: { id: true, name: true, email: true, role: true, avatarHue: true, createdAt: true } },
    },
  },
};

const FORWARD: Record<TicketStatus, TicketStatus | null> = {
  New: null,
  PendingWorkerResponse: null,
  Accepted: "InProgress",
  InProgress: "Completed",
  Completed: null,
  Rejected: null,
  Cancelled: null,
};

export function assertAllowedTransition(from: TicketStatus, to: TicketStatus) {
  if (isTerminalStatus(from)) {
    throw new HttpError(409, `Tickets in ${from} status cannot be changed`);
  }
  if (to === "New") {
    throw new HttpError(409, "Tickets cannot move back to New");
  }
  const allowed = (from === "Completed" && to === "InProgress") || FORWARD[from] === to;
  if (!allowed) {
    throw new HttpError(409, `Cannot move from ${from} to ${to}`);
  }
}

async function nextTicketNumber(tx: Prisma.TransactionClient) {
  const year = new Date().getFullYear();
  const seq = await tx.ticketSequence.upsert({
    where: { year },
    create: { year, last: 1 },
    update: { last: { increment: 1 } },
  });
  return `TCK-${year}-${String(seq.last).padStart(5, "0")}`;
}

async function recordEvent(
  tx: Prisma.TransactionClient,
  data: {
    ticketId: string;
    type: "STATUS_CHANGE" | "ASSIGNED" | "REOPENED";
    fromValue?: string | null;
    toValue?: string | null;
    actorId: string;
  },
) {
  return tx.ticketEvent.create({
    data: {
      ticketId: data.ticketId,
      type: data.type,
      fromValue: data.fromValue ?? null,
      toValue: data.toValue ?? null,
      actorId: data.actorId,
    },
  });
}

export async function listTickets(
  actor: Actor,
  query: { status?: TicketStatus; mine?: boolean; priority?: TicketPriority; category?: string },
) {
  const where: Prisma.TicketWhereInput = {
    ...customerScope(actor),
  };
  if (query.status) where.status = query.status;
  if (query.priority) where.priority = query.priority;
  if (query.category) where.category = query.category;
  if (query.mine && actor.role !== "CUSTOMER") {
    where.assignedAgentId = actor.sub;
  } else if (actor.role === "AGENT") {
    where.OR = [{ assignedAgentId: actor.sub }, { assignedAgentId: null }];
  }

  return prisma.ticket.findMany({
    where,
    include: ticketInclude,
    orderBy: [{ priority: { sort: "desc", nulls: "last" } }, { updatedAt: "desc" }],
  });
}

export async function getTicket(actor: Actor, id: string) {
  const ticket = await prisma.ticket.findUnique({
    where: { id },
    include: ticketDetailInclude,
  });
  if (!ticket) throw new HttpError(404, "Ticket not found");
  assertCanView(actor, ticket);
  return ticket;
}

export async function createTicket(
  actor: Actor,
  input: {
    subject: string;
    description: string;
    category?: string;
    customerId?: string;
  },
) {
  if (actor.role !== "CUSTOMER" && actor.role !== "ADMIN") {
    throw new HttpError(403, "Forbidden");
  }
  const customerId = actor.role === "ADMIN" && input.customerId ? input.customerId : actor.sub;

  return prisma.$transaction(async (tx) => {
    const ticketNumber = await nextTicketNumber(tx);
    return tx.ticket.create({
      data: {
        ticketNumber,
        subject: input.subject,
        description: input.description,
        category: input.category?.trim() || null,
        priority: "MEDIUM",
        customerId,
        status: "New",
        aiFailed: false,
        aiSummary: null,
        aiCategory: null,
        aiPriority: null,
        messages: {
          create: {
            senderId: customerId,
            senderRole: "CUSTOMER",
            body: input.description,
          },
        },
      },
      include: ticketInclude,
    });
  });
}

export async function attachSuggestedWorkers(ticketId: string) {
  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
  if (!ticket) return null;

  const category =
    parseOfficialCategory(ticket.aiCategory ?? "") ??
    parseOfficialCategory(ticket.category ?? "") ??
    "General";
  const workerIds = await suggestWorkers(category);

  return prisma.ticket.update({
    where: { id: ticketId },
    data: { suggestedWorkerIds: workerIds },
    include: ticketInclude,
  });
}

export async function selectWorker(actor: Actor, id: string, workerId: string) {
  if (actor.role !== "CUSTOMER") {
    throw new HttpError(403, "Forbidden");
  }

  const existing = await prisma.ticket.findUnique({ where: { id } });
  if (!existing || existing.customerId !== actor.sub) {
    throw new HttpError(404, "Ticket not found");
  }
  if (existing.status !== "New") {
    throw new HttpError(409, "Only New tickets can have a worker selected");
  }
  if (isTerminalStatus(existing.status)) {
    throw new HttpError(409, `Tickets in ${existing.status} status cannot be changed`);
  }

  const worker = await prisma.user.findFirst({
    where: { id: workerId, role: "AGENT", isAvailable: true },
  });
  if (!worker) {
    throw new HttpError(400, "Invalid or unavailable worker");
  }

  return prisma.$transaction(async (tx) => {
    const moved = await tx.ticket.updateMany({
      where: { id, status: "New", customerId: actor.sub, assignedAgentId: null },
      data: { assignedAgentId: workerId, status: "PendingWorkerResponse" },
    });
    if (moved.count !== 1) {
      throw new HttpError(409, "Ticket is no longer available for worker selection");
    }

    const ticket = await tx.ticket.findUniqueOrThrow({ where: { id }, include: ticketInclude });
    await recordEvent(tx, {
      ticketId: id,
      type: "ASSIGNED",
      fromValue: null,
      toValue: workerId,
      actorId: actor.sub,
    });
    await recordEvent(tx, {
      ticketId: id,
      type: "STATUS_CHANGE",
      fromValue: "New",
      toValue: "PendingWorkerResponse",
      actorId: actor.sub,
    });
    return ticket;
  });
}

export async function cancelTicket(actor: Actor, id: string) {
  if (actor.role !== "CUSTOMER") {
    throw new HttpError(403, "Forbidden");
  }

  const existing = await prisma.ticket.findUnique({ where: { id } });
  if (!existing || existing.customerId !== actor.sub) {
    throw new HttpError(404, "Ticket not found");
  }
  if (existing.status !== "New" && existing.status !== "PendingWorkerResponse") {
    throw new HttpError(409, "Ticket cannot be cancelled in its current status");
  }

  return prisma.$transaction(async (tx) => {
    const moved = await tx.ticket.updateMany({
      where: {
        id,
        customerId: actor.sub,
        status: { in: ["New", "PendingWorkerResponse"] },
      },
      data: { status: "Cancelled" },
    });
    if (moved.count !== 1) {
      throw new HttpError(409, "Ticket cannot be cancelled in its current status");
    }

    const ticket = await tx.ticket.findUniqueOrThrow({ where: { id }, include: ticketInclude });
    await recordEvent(tx, {
      ticketId: id,
      type: "STATUS_CHANGE",
      fromValue: existing.status,
      toValue: "Cancelled",
      actorId: actor.sub,
    });
    return ticket;
  });
}

export async function updateTicketMeta(
  actor: Actor,
  id: string,
  input: { subject?: string; category?: string; priority?: TicketPriority },
) {
  const existing = await prisma.ticket.findUnique({ where: { id } });
  if (!existing) throw new HttpError(404, "Ticket not found");
  assertCanMutate(actor, existing, "assigned");

  return prisma.ticket.update({
    where: { id },
    data: {
      subject: input.subject,
      category: input.category,
      priority: input.priority,
    },
    include: ticketInclude,
  });
}

export async function claimTicket(actor: Actor, id: string) {
  const existing = await prisma.ticket.findUnique({ where: { id } });
  if (!existing) throw new HttpError(404, "Ticket not found");
  assertCanMutate(actor, existing, "claim");
  if (existing.status !== "New") {
    throw new HttpError(409, "Only New tickets can be claimed");
  }

  return prisma.$transaction(async (tx) => {
    const moved = await tx.ticket.updateMany({
      where: { id, status: "New", assignedAgentId: null },
      data: { assignedAgentId: actor.sub, status: "PendingWorkerResponse" },
    });
    if (moved.count !== 1) {
      throw new HttpError(409, "Ticket is already assigned");
    }
    const ticket = await tx.ticket.findUniqueOrThrow({ where: { id }, include: ticketInclude });
    await recordEvent(tx, {
      ticketId: id,
      type: "ASSIGNED",
      fromValue: null,
      toValue: actor.sub,
      actorId: actor.sub,
    });
    await recordEvent(tx, {
      ticketId: id,
      type: "STATUS_CHANGE",
      fromValue: "New",
      toValue: "PendingWorkerResponse",
      actorId: actor.sub,
    });
    return ticket;
  });
}

export async function respondToBooking(
  actor: Actor,
  id: string,
  input:
    | { action: "accept"; urgency: TicketPriority }
    | { action: "reject"; rejectionReason: string },
) {
  const existing = await prisma.ticket.findUnique({ where: { id } });
  if (!existing) throw new HttpError(404, "Ticket not found");
  if (actor.role !== "AGENT" && actor.role !== "ADMIN") {
    throw new HttpError(403, "Forbidden");
  }
  if (actor.role === "AGENT" && existing.assignedAgentId !== actor.sub) {
    throw new HttpError(403, "You can only respond to tickets assigned to you");
  }
  if (existing.status !== "PendingWorkerResponse") {
    throw new HttpError(409, "Only pending bookings can be responded to");
  }
  if (isTerminalStatus(existing.status)) {
    throw new HttpError(409, `Tickets in ${existing.status} status cannot be changed`);
  }

  if (input.action === "reject") {
    const reason = input.rejectionReason.trim();
    if (!reason) {
      throw new HttpError(400, "rejectionReason is required");
    }

    return prisma.$transaction(async (tx) => {
      const moved = await tx.ticket.updateMany({
        where: { id, status: "PendingWorkerResponse" },
        data: { status: "Rejected", rejectionReason: reason },
      });
      if (moved.count !== 1) {
        throw new HttpError(409, "Only pending bookings can be responded to");
      }
      const ticket = await tx.ticket.findUniqueOrThrow({ where: { id }, include: ticketInclude });
      await recordEvent(tx, {
        ticketId: id,
        type: "STATUS_CHANGE",
        fromValue: "PendingWorkerResponse",
        toValue: "Rejected",
        actorId: actor.sub,
      });
      return ticket;
    });
  }

  return prisma.$transaction(async (tx) => {
    const moved = await tx.ticket.updateMany({
      where: {
        id,
        status: "PendingWorkerResponse",
        assignedAgentId: actor.role === "ADMIN" ? existing.assignedAgentId : actor.sub,
      },
      data: { status: "Accepted", urgency: input.urgency },
    });
    if (moved.count !== 1) {
      throw new HttpError(409, "Only pending bookings can be responded to");
    }
    const ticket = await tx.ticket.findUniqueOrThrow({ where: { id }, include: ticketInclude });
    await recordEvent(tx, {
      ticketId: id,
      type: "STATUS_CHANGE",
      fromValue: "PendingWorkerResponse",
      toValue: "Accepted",
      actorId: actor.sub,
    });
    return ticket;
  });
}

export async function startTicket(actor: Actor, id: string) {
  const existing = await prisma.ticket.findUnique({ where: { id } });
  if (!existing) throw new HttpError(404, "Ticket not found");
  assertCanMutate(actor, existing, "assigned");
  if (existing.status !== "Accepted") {
    throw new HttpError(409, "Only Accepted tickets can move to In Progress");
  }

  return prisma.$transaction(async (tx) => {
    const moved = await tx.ticket.updateMany({
      where: { id, status: "Accepted" },
      data: { status: "InProgress" },
    });
    if (moved.count !== 1) {
      throw new HttpError(409, "Only Accepted tickets can move to In Progress");
    }
    const ticket = await tx.ticket.findUniqueOrThrow({ where: { id }, include: ticketInclude });
    await recordEvent(tx, {
      ticketId: id,
      type: "STATUS_CHANGE",
      fromValue: "Accepted",
      toValue: "InProgress",
      actorId: actor.sub,
    });
    return ticket;
  });
}

export async function resolveTicket(actor: Actor, id: string, resolutionNote: string) {
  const note = resolutionNote.trim();
  if (!note) {
    throw new HttpError(400, "Resolved tickets require a resolution note");
  }
  const existing = await prisma.ticket.findUnique({ where: { id } });
  if (!existing) throw new HttpError(404, "Ticket not found");
  assertCanMutate(actor, existing, "assigned");
  if (existing.status !== "InProgress") {
    throw new HttpError(409, "Only In Progress tickets can be completed");
  }

  return prisma.$transaction(async (tx) => {
    const moved = await tx.ticket.updateMany({
      where: { id, status: "InProgress" },
      data: { status: "Completed", resolutionNote: note },
    });
    if (moved.count !== 1) {
      throw new HttpError(409, "Only In Progress tickets can be completed");
    }
    const ticket = await tx.ticket.findUniqueOrThrow({ where: { id }, include: ticketInclude });
    await recordEvent(tx, {
      ticketId: id,
      type: "STATUS_CHANGE",
      fromValue: "InProgress",
      toValue: "Completed",
      actorId: actor.sub,
    });

    const agent = await tx.user.findUnique({ where: { id: actor.sub }, select: { name: true } });
    const workerLabel = agent?.name ?? "Your worker";
    const completionMessage = await tx.message.create({
      data: {
        ticketId: id,
        senderId: actor.sub,
        senderRole: actor.role,
        body: `${workerLabel} marked this ticket as completed.\n\nResolution: ${note}\n\nPlease leave a review when you have a moment — your feedback appears on the worker's profile and helps other customers.`,
      },
      include: {
        sender: { select: { id: true, name: true, email: true, role: true, avatarHue: true, createdAt: true } },
      },
    });

    return { ticket, completionMessage };
  });
}

export async function reopenTicket(actor: Actor, id: string) {
  const existing = await prisma.ticket.findUnique({ where: { id } });
  if (!existing) throw new HttpError(404, "Ticket not found");
  assertCanMutate(actor, existing, "assigned");
  if (existing.status !== "Completed") {
    throw new HttpError(409, "Only Completed tickets can be reopened");
  }

  return prisma.$transaction(async (tx) => {
    const moved = await tx.ticket.updateMany({
      where: { id, status: "Completed" },
      data: { status: "InProgress" },
    });
    if (moved.count !== 1) {
      throw new HttpError(409, "Only Completed tickets can be reopened");
    }
    const ticket = await tx.ticket.findUniqueOrThrow({ where: { id }, include: ticketInclude });
    await recordEvent(tx, {
      ticketId: id,
      type: "REOPENED",
      fromValue: "Completed",
      toValue: "InProgress",
      actorId: actor.sub,
    });
    return ticket;
  });
}

export async function addMessage(actor: Actor, id: string, body: string) {
  const ticket = await prisma.ticket.findUnique({ where: { id } });
  if (!ticket) throw new HttpError(404, "Ticket not found");
  assertCanView(actor, ticket);
  if (actor.role === "AGENT") {
    assertCanMutate(actor, ticket, "assigned");
  }
  if (isTerminalStatus(ticket.status)) {
    throw new HttpError(409, "Reopen the ticket before sending a message");
  }

  return prisma.message.create({
    data: {
      ticketId: ticket.id,
      senderId: actor.sub,
      senderRole: actor.role,
      body,
    },
    include: {
      sender: { select: { id: true, name: true, email: true, role: true, avatarHue: true, createdAt: true } },
    },
  });
}

export async function applyAiTriage(
  id: string,
  input: {
    category: string;
    priority: string;
    summary: string;
    raw: Prisma.InputJsonValue;
  },
) {
  return prisma.ticket.update({
    where: { id },
    data: {
      aiCategory: input.category,
      aiPriority: input.priority,
      aiSummary: input.summary || null,
      aiConfidenceRaw: input.raw,
      aiFailed: false,
    },
    include: ticketInclude,
  });
}

export async function applyAiFailure(id: string, reason: string) {
  return prisma.ticket.update({
    where: { id },
    data: {
      aiSummary: null,
      aiCategory: null,
      aiPriority: null,
      aiFailed: true,
      aiConfidenceRaw: { failed: true, reason },
    },
    include: ticketInclude,
  });
}

export async function applyAiSummary(id: string, summary: string) {
  return prisma.ticket.update({
    where: { id },
    data: { aiSummary: summary },
    include: ticketInclude,
  });
}

export async function changeTicketStatus(
  actor: Actor,
  id: string,
  status: TicketStatus,
  resolutionNote?: string,
): Promise<{ ticket: NonNullable<Awaited<ReturnType<typeof claimTicket>>>; completionMessage?: Awaited<ReturnType<typeof addMessage>> }> {
  if (status === "PendingWorkerResponse") {
    return { ticket: await claimTicket(actor, id) };
  }
  if (status === "InProgress") {
    const existing = await prisma.ticket.findUnique({ where: { id } });
    if (!existing) throw new HttpError(404, "Ticket not found");
    if (existing.status === "Completed") return { ticket: await reopenTicket(actor, id) };
    return { ticket: await startTicket(actor, id) };
  }
  if (status === "Completed") {
    const result = await resolveTicket(actor, id, resolutionNote ?? "");
    return { ticket: result.ticket, completionMessage: result.completionMessage };
  }
  throw new HttpError(409, "Invalid status transition");
}

export async function acceptAiSuggestion(
  actor: Actor,
  id: string,
  input: { category: string; priority: TicketPriority; summary: string },
) {
  const existing = await prisma.ticket.findUnique({ where: { id } });
  if (!existing) throw new HttpError(404, "Ticket not found");
  assertCanMutate(actor, existing, "assigned");

  return prisma.ticket.update({
    where: { id },
    data: {
      category: input.category,
      priority: input.priority,
      aiSummary: input.summary,
      aiFailed: false,
    },
    include: ticketInclude,
  });
}

export function nextStatus(status: TicketStatus) {
  return FORWARD[status];
}
