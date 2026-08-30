import { prisma } from "../lib/prisma.js";
import { ticketInclude } from "./tickets.js";

const STOP = new Set([
  "this", "that", "with", "from", "have", "been", "were", "your", "about", "after",
  "need", "just", "into", "they", "them", "then", "than", "when", "what", "which",
]);

function tokens(text: string) {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((word) => word.length > 3 && !STOP.has(word)),
  );
}

function jaccard(a: Set<string>, b: Set<string>) {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const word of a) if (b.has(word)) inter += 1;
  return inter / (a.size + b.size - inter);
}

export async function findDuplicateTickets(input: {
  id?: string;
  subject: string;
  description: string;
  scopeCustomerId?: string;
}) {
  const needle = tokens(`${input.subject} ${input.description}`);
  if (needle.size === 0) return [];

  const candidates = await prisma.ticket.findMany({
    where: {
      status: { not: "Completed" },
      ...(input.id ? { id: { not: input.id } } : {}),
      ...(input.scopeCustomerId ? { customerId: input.scopeCustomerId } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 80,
    include: ticketInclude,
  });

  return candidates
    .map((ticket) => ({
      ticket,
      score: jaccard(needle, tokens(`${ticket.subject} ${ticket.description}`)),
    }))
    .filter((row) => row.score >= 0.28)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((row) => row.ticket);
}
