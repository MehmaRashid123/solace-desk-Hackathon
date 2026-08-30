import { Router } from "express";
import { z } from "zod";
import type { TicketPriority, TicketStatus } from "@prisma/client";
import { auth, currentUser, requireRole, routeId } from "../middleware/auth.js";
import { emitAssigned, emitMessageNew, emitRatingSubmitted, emitStatusChanged, emitWorkerResponded, emitWorkerSelected } from "../lib/io.js";
import { HttpError } from "../lib/httpError.js";
import { assertTicketOwner } from "../lib/ticketAccess.js";
import {
  acceptAiSuggestion,
  addMessage,
  changeTicketStatus,
  assertAllowedTransition,
  attachSuggestedWorkers,
  cancelTicket,
  claimTicket,
  createTicket,
  getTicket,
  listTickets,
  respondToBooking,
  selectWorker,
} from "../services/tickets.js";
import { prisma } from "../lib/prisma.js";
import { parseOfficialCategory, parseOfficialPriority } from "../lib/taxonomy.js";
import { draftTicketResolution, draftTicketRatingReview, previewTriage, runInternalTriage } from "../services/triage.js";
import { findDuplicateTickets } from "../services/duplicates.js";
import { submitWorkerRating } from "../services/ratings.js";
import { sendOk } from "../lib/respond.js";

export const ticketsRouter = Router();
ticketsRouter.use(auth);

const officialCategory = z.string().transform((value, ctx) => {
  const parsed = parseOfficialCategory(value);
  if (!parsed) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "category must be Billing, Technical, Account, or General" });
    return z.NEVER;
  }
  return parsed;
});

const officialPriority = z.string().transform((value, ctx) => {
  const parsed = parseOfficialPriority(value);
  if (!parsed) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "priority must be Low, Medium, or High" });
    return z.NEVER;
  }
  return parsed;
});

const createSchema = z.object({
  subject: z.string().min(4).max(140),
  description: z.string().min(8).max(4000),
  category: officialCategory.optional(),
});

const statusSchema = z
  .object({
    status: z.enum([
      "New",
      "PendingWorkerResponse",
      "Accepted",
      "InProgress",
      "Completed",
      "Rejected",
      "Cancelled",
    ]),
    resolutionNote: z.string().max(4000).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.status === "Completed" && !value.resolutionNote?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Completed tickets require a resolution note",
        path: ["resolutionNote"],
      });
    }
  });

const aiReviewSchema = z.object({
  category: officialCategory.optional(),
  priority: officialPriority.optional(),
  summary: z.string().min(1).max(2000).optional(),
  regenerate: z.boolean().optional(),
});

const messageSchema = z.object({
  body: z.string().min(1).max(4000),
});

const respondSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("accept"),
    urgency: officialPriority,
  }),
  z.object({
    action: z.literal("reject"),
    rejectionReason: z.string().min(1).max(2000),
  }),
]);

const selectWorkerSchema = z.object({
  workerId: z.string().min(1),
});

const ratingSchema = z.object({
  stars: z.number().int().min(1).max(5),
  comment: z.string().max(2000).optional(),
});

async function loadTicket(id: string) {
  const ticket = await prisma.ticket.findUnique({ where: { id } });
  if (!ticket) throw new HttpError(404, "Ticket not found");
  return ticket;
}

ticketsRouter.get("/mine", async (req, res, next) => {
  try {
    const actor = currentUser(req);
    const tickets = await listTickets(actor, {
      mine: actor.role !== "CUSTOMER",
    });
    sendOk(res, { tickets });
  } catch (err) {
    next(err);
  }
});

ticketsRouter.get("/", requireRole("AGENT", "ADMIN"), async (req, res, next) => {
  try {
    const status = typeof req.query.status === "string" ? req.query.status : undefined;
    const priority = typeof req.query.priority === "string" ? req.query.priority : undefined;
    const category = typeof req.query.category === "string" ? req.query.category : undefined;
    if (
      status &&
      ![
        "New",
        "PendingWorkerResponse",
        "Accepted",
        "InProgress",
        "Completed",
        "Rejected",
        "Cancelled",
      ].includes(status)
    ) {
      throw new HttpError(400, "Invalid status filter");
    }
    if (priority && !parseOfficialPriority(priority)) {
      throw new HttpError(400, "Invalid priority filter");
    }
    if (category && !parseOfficialCategory(category)) {
      throw new HttpError(400, "Invalid category filter");
    }
    const tickets = await listTickets(currentUser(req), {
      status: status as TicketStatus | undefined,
      priority: priority as TicketPriority | undefined,
      category,
    });
    sendOk(res, { tickets });
  } catch (err) {
    next(err);
  }
});

ticketsRouter.get("/:id", async (req, res, next) => {
  try {
    const existing = await loadTicket(routeId(req));
    assertTicketOwner(currentUser(req), existing, "view");
    const actor = currentUser(req);
    const ticket = await getTicket(actor, existing.id);
    const duplicates = (await findDuplicateTickets({
      ...ticket,
      scopeCustomerId: actor.role === "CUSTOMER" ? actor.sub : undefined,
    })).filter((item) => actor.role !== "AGENT" || !item.assignedAgentId || item.assignedAgentId === actor.sub);
    sendOk(res, { ticket, duplicates });
  } catch (err) {
    next(err);
  }
});

const triagePreviewSchema = z.object({
  subject: z.string().min(4).max(140),
  description: z.string().min(8).max(4000),
});

ticketsRouter.post("/triage-preview", requireRole("CUSTOMER", "ADMIN"), async (req, res, next) => {
  try {
    const body = triagePreviewSchema.parse(req.body);
    const suggestion = await previewTriage(body);
    sendOk(res, { suggestion });
  } catch (err) {
    next(err);
  }
});

ticketsRouter.post("/", requireRole("CUSTOMER", "ADMIN"), async (req, res, next) => {
  try {
    const body = createSchema.parse(req.body);
    const ticket = await createTicket(currentUser(req), {
      subject: body.subject,
      description: body.description,
      category: body.category,
    });
    let result = ticket;
    try {
      result = (await runInternalTriage(ticket.id)) ?? ticket;
      result = (await attachSuggestedWorkers(result.id)) ?? result;
    } catch (err) {
      console.warn("Triage did not block create:", err instanceof Error ? err.message : err);
    }
    const actor = currentUser(req);
    const duplicates = await findDuplicateTickets({
      ...result,
      scopeCustomerId: actor.role === "CUSTOMER" ? actor.sub : undefined,
    });
    emitStatusChanged(result);
    sendOk(res, { ticket: result, duplicates }, 201);
  } catch (err) {
    next(err);
  }
});

ticketsRouter.patch("/:id/assign", requireRole("AGENT", "ADMIN"), async (req, res, next) => {
  try {
    const existing = await loadTicket(routeId(req));
    assertTicketOwner(currentUser(req), existing, "claim");
    const ticket = await claimTicket(currentUser(req), existing.id);
    emitAssigned(ticket);
    emitStatusChanged(ticket);
    sendOk(res, { ticket });
  } catch (err) {
    next(err);
  }
});

ticketsRouter.patch("/:id/select-worker", requireRole("CUSTOMER"), async (req, res, next) => {
  try {
    const body = selectWorkerSchema.parse(req.body);
    const existing = await loadTicket(routeId(req));
    if (existing.customerId !== currentUser(req).sub) {
      throw new HttpError(404, "Ticket not found");
    }
    const ticket = await selectWorker(currentUser(req), existing.id, body.workerId);
    emitWorkerSelected(body.workerId, ticket);
    sendOk(res, { ticket });
  } catch (err) {
    next(err);
  }
});

ticketsRouter.patch("/:id/respond", requireRole("AGENT", "ADMIN"), async (req, res, next) => {
  try {
    const body = respondSchema.parse(req.body);
    const existing = await loadTicket(routeId(req));
    if (currentUser(req).role === "AGENT" && existing.assignedAgentId !== currentUser(req).sub) {
      throw new HttpError(403, "You can only respond to tickets assigned to you");
    }
    const ticket = await respondToBooking(currentUser(req), existing.id, body);
    emitWorkerResponded(ticket);
    if (body.action === "accept") {
      emitStatusChanged(ticket);
    }
    sendOk(res, { ticket, action: body.action });
  } catch (err) {
    next(err);
  }
});

ticketsRouter.patch("/:id/cancel", requireRole("CUSTOMER"), async (req, res, next) => {
  try {
    const existing = await loadTicket(routeId(req));
    if (existing.customerId !== currentUser(req).sub) {
      throw new HttpError(404, "Ticket not found");
    }
    const ticket = await cancelTicket(currentUser(req), existing.id);
    emitStatusChanged(ticket);
    sendOk(res, { ticket });
  } catch (err) {
    next(err);
  }
});

ticketsRouter.post("/:id/ai-rating-draft", requireRole("CUSTOMER"), async (req, res, next) => {
  try {
    const existing = await loadTicket(routeId(req));
    if (existing.customerId !== currentUser(req).sub) {
      throw new HttpError(404, "Ticket not found");
    }
    if (existing.status !== "Completed") {
      throw new HttpError(409, "Only completed tickets can have rating drafts");
    }
    const draft = await draftTicketRatingReview(existing.id);
    sendOk(res, draft);
  } catch (err) {
    next(err);
  }
});

ticketsRouter.post("/:id/rating", requireRole("CUSTOMER"), async (req, res, next) => {
  try {
    const body = ratingSchema.parse(req.body);
    const existing = await loadTicket(routeId(req));
    if (existing.customerId !== currentUser(req).sub) {
      throw new HttpError(404, "Ticket not found");
    }
    const result = await submitWorkerRating(currentUser(req), existing.id, body);
    const actor = currentUser(req);
    emitRatingSubmitted(existing.id, {
      ticketId: existing.id,
      workerId: result.workerId,
      review: {
        id: result.rating.id,
        stars: result.rating.stars,
        comment: result.rating.comment,
        customerName: actor.name,
        createdAt: result.rating.createdAt.toISOString(),
      },
    });
    sendOk(res, { rating: result.rating, ticket: result.ticket }, 201);
  } catch (err) {
    next(err);
  }
});

ticketsRouter.patch("/:id/status", requireRole("AGENT", "ADMIN"), async (req, res, next) => {
  try {
    const body = statusSchema.parse(req.body);
    const existing = await loadTicket(routeId(req));
    assertAllowedTransition(existing.status, body.status);
    assertTicketOwner(currentUser(req), existing, body.status === "PendingWorkerResponse" ? "claim" : "assigned");
    const { ticket, completionMessage } = await changeTicketStatus(currentUser(req), existing.id, body.status, body.resolutionNote);
    if (body.status === "PendingWorkerResponse") emitAssigned(ticket);
    if (completionMessage) {
      emitMessageNew(ticket.id, { ticketId: ticket.id, message: completionMessage });
    }
    emitStatusChanged(ticket);
    sendOk(res, { ticket, message: completionMessage ?? undefined });
  } catch (err) {
    next(err);
  }
});

ticketsRouter.patch("/:id/ai-review", requireRole("AGENT", "ADMIN"), async (req, res, next) => {
  try {
    const body = aiReviewSchema.parse(req.body);
    const existing = await loadTicket(routeId(req));
    assertTicketOwner(currentUser(req), existing, "assigned");
    if (body.regenerate) {
      const ticket = (await runInternalTriage(existing.id)) ?? existing;
      sendOk(res, { ticket });
      return;
    }
    if (!body.category || !body.priority || !body.summary) {
      throw new HttpError(400, "category, priority, and summary are required");
    }
    const ticket = await acceptAiSuggestion(currentUser(req), existing.id, {
      category: body.category,
      priority: body.priority,
      summary: body.summary,
    });
    sendOk(res, { ticket });
  } catch (err) {
    next(err);
  }
});

ticketsRouter.post("/:id/ai-resolve-draft", requireRole("AGENT", "ADMIN"), async (req, res, next) => {
  try {
    const existing = await loadTicket(routeId(req));
    assertTicketOwner(currentUser(req), existing, "assigned");
    const summary = await draftTicketResolution(existing.id);
    sendOk(res, { summary });
  } catch (err) {
    next(err);
  }
});

ticketsRouter.post("/:id/messages", async (req, res, next) => {
  try {
    const { body } = messageSchema.parse(req.body);
    const existing = await loadTicket(routeId(req));
    const actor = currentUser(req);
    assertTicketOwner(actor, existing, actor.role === "AGENT" ? "assigned" : "view");
    const message = await addMessage(actor, existing.id, body);
    emitMessageNew(message.ticketId, { ticketId: message.ticketId, message });
    sendOk(res, { message }, 201);
  } catch (err) {
    next(err);
  }
});
