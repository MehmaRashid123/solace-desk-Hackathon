import type { Ticket } from "@/lib/types";

/** Merge socket/API ticket updates without regressing status or clearing a submitted rating. */
export function mergeTicketUpdate(prev: Ticket, next: Ticket): Ticket {
  const nextTime = new Date(next.updatedAt).getTime();
  const prevTime = new Date(prev.updatedAt).getTime();
  const useNext = Number.isNaN(nextTime) || Number.isNaN(prevTime) ? true : nextTime >= prevTime;

  return {
    ...prev,
    ...next,
    status: useNext && next.status ? next.status : prev.status,
    workerRating: next.workerRating ?? prev.workerRating ?? null,
    resolutionNote: useNext ? (next.resolutionNote ?? prev.resolutionNote) : prev.resolutionNote,
    messages: prev.messages?.length ? prev.messages : next.messages ?? prev.messages,
    events: next.events?.length ? next.events : prev.events,
  };
}
