import { prisma } from "../lib/prisma.js";
import { applyAiFailure, applyAiTriage } from "./tickets.js";
import { draftResolutionNote, draftRatingReview, runTriagePrompt } from "./ai.js";

export async function runInternalTriage(ticketId: string) {
  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    include: { messages: { orderBy: { createdAt: "asc" }, take: 20 } },
  });
  if (!ticket) return null;

  try {
    const result = await runTriagePrompt({
      title: ticket.subject,
      description: ticket.description,
      messages: ticket.messages.map((m) => ({
        role: m.senderRole === "CUSTOMER" ? "user" : "assistant",
        content: m.body,
      })),
    });

    return applyAiTriage(ticket.id, {
      category: result.raw.category,
      priority: result.raw.priority,
      summary: result.raw.summary,
      raw: { source: result.source, text: result.text, parsed: result.raw },
    });
  } catch (err) {
    const reason = err instanceof Error ? err.message : "AI_FAILED";
    console.warn("Triage failed open:", reason);
    return applyAiFailure(ticket.id, reason);
  }
}

export async function draftTicketResolution(ticketId: string) {
  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    include: { messages: { orderBy: { createdAt: "asc" }, take: 20 } },
  });
  if (!ticket) return "Ticket resolved.";

  return draftResolutionNote({
    title: ticket.subject,
    description: ticket.description,
    messages: ticket.messages.map((m) => ({
      role: m.senderRole === "CUSTOMER" ? "user" : "assistant",
      content: m.body,
    })),
  });
}

export async function draftTicketRatingReview(ticketId: string) {
  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    include: {
      messages: { orderBy: { createdAt: "asc" }, take: 20 },
      assignedAgent: { select: { name: true } },
    },
  });
  if (!ticket) return { stars: 4, comment: "Great support — thank you!" };
  if (ticket.status !== "Completed") {
    throw new Error("Only completed tickets can have rating drafts");
  }

  return draftRatingReview({
    title: ticket.subject,
    description: ticket.description,
    resolutionNote: ticket.resolutionNote,
    workerName: ticket.assignedAgent?.name ?? "the agent",
    messages: ticket.messages.map((m) => ({
      role: m.senderRole === "CUSTOMER" ? "user" : "assistant",
      content: m.body,
    })),
  });
}
