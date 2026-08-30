"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { LoaderCircle, RefreshCw, Send } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useSocket } from "@/context/SocketContext";
import { api } from "@/lib/api";
import { normalizeCategory, normalizePriority, statusLabel } from "@/lib/format";
import { buildTimelineEvents } from "@/lib/ticketDetail";
import type { Message, Ticket, TicketPriority } from "@/lib/types";
import { Avatar, Button, EmptyState, Field, Glass, Skeleton, StatusBadge, Textarea } from "@/components/ui";
import { TicketTimeline } from "@/components/TicketTimeline";
import { TicketInfoPills, ticketPillIcons } from "@/components/TicketInfoPills";
import { WorkerSelectionPanel } from "@/components/WorkerCard";
import { WorkerRatingPanel, WorkerRatingSubmitted } from "@/components/WorkerRatingPanel";
import { AiReviewCard } from "@/components/AiReviewCard";
import { AiTriageSuggestion } from "@/components/AiTriageSuggestion";
import { cn } from "@/lib/cn";
import { ticketDetailPath, ticketsPath } from "@/lib/routes";
import { mergeTicketUpdate } from "@/lib/mergeTicket";
import { isAccepted, isCompleted, isInProgress, isNew } from "@/lib/ticketStatus";
import { useToast } from "@/context/ToastContext";

export default function TicketDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user, accessToken } = useAuth();
  const { socket } = useSocket();
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [draft, setDraft] = useState("");
  const [resolutionNote, setResolutionNote] = useState("");
  const [aiCategory, setAiCategory] = useState("");
  const [aiPriority, setAiPriority] = useState<TicketPriority | "">("");
  const [aiSummary, setAiSummary] = useState("");
  const [typingName, setTypingName] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  const [aiBusy, setAiBusy] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectingWorkerId, setSelectingWorkerId] = useState<string | null>(null);
  const [editing, setEditing] = useState({ category: false, priority: false, summary: false });
  const bottomRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  function suggestionFrom(next: Ticket) {
    if (next.aiFailed && !next.category && !next.priority) {
      return { category: "", priority: "" as const, summary: next.aiSummary ?? "" };
    }
    return {
      category: normalizeCategory(next.category) || normalizeCategory(next.aiCategory),
      priority: next.priority || normalizePriority(next.aiPriority),
      summary: next.aiSummary ?? "",
    };
  }

  function applyTicket(next: Ticket) {
    setTicket(next);
    setResolutionNote(next.resolutionNote ?? "");
    const suggestion = suggestionFrom(next);
    setAiCategory(suggestion.category);
    setAiPriority(suggestion.priority);
    setAiSummary(suggestion.summary);
  }

  useEffect(() => {
    if (!accessToken || !id) return;
    setLoading(true);
    setLoadError(null);
    void api<{ ticket: Ticket }>(`/tickets/${id}`, { token: accessToken })
      .then((r) => {
        applyTicket(r.ticket);
        setEditing({
          category: Boolean(r.ticket.aiFailed && !r.ticket.category),
          priority: Boolean(r.ticket.aiFailed && !r.ticket.priority),
          summary: Boolean(r.ticket.aiFailed && !r.ticket.aiSummary),
        });
      })
      .catch((err) => {
        const message = err instanceof Error ? err.message : "Could not load ticket";
        setLoadError(message);
        toast(message);
      })
      .finally(() => setLoading(false));
  }, [accessToken, id, toast]);

  function reloadTicket() {
    if (!accessToken || !id) return;
    setLoading(true);
    setLoadError(null);
    void api<{ ticket: Ticket }>(`/tickets/${id}`, { token: accessToken })
      .then((r) => {
        applyTicket(r.ticket);
      })
      .catch((err) => setLoadError(err instanceof Error ? err.message : "Could not load ticket"))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [ticket?.messages?.length]);

  useEffect(() => {
    if (!socket || !id) return;
    const join = () => socket.emit("ticket:join", id);
    join();
    socket.on("connect", join);
    const onMessage = (payload: { ticketId: string; message: Message }) => {
      if (payload.ticketId !== id) return;
      setTicket((prev) => {
        if (!prev) return prev;
        const exists = prev.messages?.some((m) => m.id === payload.message.id);
        return { ...prev, messages: exists ? prev.messages : [...(prev.messages ?? []), payload.message] };
      });
    };
    const onTicket = (next: Ticket) => {
      if (next.id !== id) return;
      setTicket((prev) => {
        if (!prev) return next;
        const merged = mergeTicketUpdate(prev, next);
        const suggestion = suggestionFrom(merged);
        setAiCategory(suggestion.category);
        setAiPriority(suggestion.priority);
        setAiSummary(suggestion.summary);
        return merged;
      });
    };
    const onTyping = (payload: { ticketId: string; name: string; userId: string; typing: boolean }) => {
      if (payload.ticketId !== id || payload.userId === user?.id) return;
      setTypingName(payload.typing ? payload.name : null);
    };
    const onRating = (payload: {
      ticketId: string;
      review?: { id: string; stars: number; comment: string | null };
      rating?: { id: string; stars: number; comment: string | null };
    }) => {
      if (payload.ticketId !== id) return;
      const rating = payload.review ?? payload.rating;
      if (!rating) return;
      setTicket((prev) =>
        prev
          ? mergeTicketUpdate(prev, {
              ...prev,
              workerRating: {
                id: rating.id,
                stars: rating.stars,
                comment: rating.comment,
              },
            })
          : prev,
      );
    };
    socket.on("message:new", onMessage);
    socket.on("ticket:statusChanged", onTicket);
    socket.on("ticket:assigned", onTicket);
    socket.on("rating:submitted", onRating);
    socket.on("typing", onTyping);
    return () => {
      socket.off("connect", join);
      socket.emit("ticket:leave", id);
      socket.off("message:new", onMessage);
      socket.off("ticket:statusChanged", onTicket);
      socket.off("ticket:assigned", onTicket);
      socket.off("rating:submitted", onRating);
      socket.off("typing", onTyping);
    };
  }, [socket, id, user?.id]);

  async function send() {
    if (!accessToken || !draft.trim()) return;
    setBusy(true);
    setActionError("");
    try {
      const { message } = await api<{ message: Message }>(`/tickets/${id}/messages`, {
        method: "POST",
        token: accessToken,
        body: { body: draft.trim() },
      });
      setTicket((prev) => {
        if (!prev) return prev;
        const exists = prev.messages?.some((m) => m.id === message.id);
        return { ...prev, messages: exists ? prev.messages : [...(prev.messages ?? []), message] };
      });
      setDraft("");
      socket?.emit("typing", { ticketId: id, typing: false });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not send";
      setActionError(message);
      toast(message);
    } finally {
      setBusy(false);
    }
  }

  async function selectWorker(workerId: string) {
    if (!accessToken) return;
    setSelectingWorkerId(workerId);
    setActionError("");
    try {
      const { ticket: next } = await api<{ ticket: Ticket }>(`/tickets/${id}/select-worker`, {
        method: "PATCH",
        token: accessToken,
        body: { workerId },
      });
      applyTicket(next);
      toast("Worker selected — waiting for their response", "ok");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not select worker";
      setActionError(message);
      toast(message);
    } finally {
      setSelectingWorkerId(null);
    }
  }

  async function patchTicket(path: string, body?: unknown) {
    if (!accessToken) return;
    setActionError("");
    try {
      const { ticket: next } = await api<{ ticket: Ticket }>(path, { method: "PATCH", token: accessToken, body });
      setTicket((prev) => {
        if (!prev) return next;
        return mergeTicketUpdate(prev, { ...next, messages: prev.messages, events: next.events ?? prev.events });
      });
      const suggestion = suggestionFrom(next);
      setAiCategory(suggestion.category);
      setAiPriority(suggestion.priority);
      setAiSummary(suggestion.summary);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Action failed";
      setActionError(message);
      toast(message);
    }
  }

  async function advanceStatus(next: "InProgress" | "Completed") {
    if (!ticket) return;
    if (next === "Completed" && !resolutionNote.trim()) {
      setActionError("A resolution note is required to complete this ticket");
      return;
    }
    await patchTicket(`/tickets/${id}/status`, {
      status: next,
      ...(next === "Completed" ? { resolutionNote } : {}),
    });
  }

  async function acceptAi() {
    await patchTicket(`/tickets/${id}/ai-review`, {
      category: aiCategory,
      priority: aiPriority,
      summary: aiSummary,
    });
  }

  function approveField(field: "category" | "priority" | "summary") {
    if (!ticket) return;
    if (field === "category") setAiCategory(normalizeCategory(ticket.aiCategory));
    if (field === "priority") setAiPriority(normalizePriority(ticket.aiPriority));
    if (field === "summary") setAiSummary(ticket.aiSummary ?? "");
    setEditing((prev) => ({ ...prev, [field]: false }));
  }

  function rejectField(field: "category" | "priority" | "summary") {
    setEditing((prev) => ({ ...prev, [field]: true }));
  }

  async function regenerate() {
    if (!accessToken) return;
    setAiBusy("triage");
    setActionError("");
    try {
      await patchTicket(`/tickets/${id}/ai-review`, { regenerate: true });
    } finally {
      setAiBusy(null);
    }
  }

  async function draftResolution() {
    if (!accessToken) return;
    setAiBusy("resolve");
    setActionError("");
    try {
      const { summary } = await api<{ summary: string }>(`/tickets/${id}/ai-resolve-draft`, {
        method: "POST",
        token: accessToken,
      });
      setResolutionNote(summary);
      toast("Resolution draft ready — edit if needed, then resolve", "ok");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not draft resolution";
      setActionError(message);
      toast(message);
    } finally {
      setAiBusy(null);
    }
  }

  if (loading) {
    return (
      <div className="grid gap-5 xl:grid-cols-[1fr_320px]">
        <Skeleton className="min-h-[70vh]" />
        <div className="space-y-4">
          <Skeleton className="h-40" />
          <Skeleton className="h-56" />
        </div>
      </div>
    );
  }

  if (loadError && !ticket) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4 text-center">
        <p className="max-w-sm text-secondary">{loadError}</p>
        <Button variant="pill" onClick={reloadTicket}>
          <RefreshCw size={15} />
          Try again
        </Button>
      </div>
    );
  }

  if (!ticket) {
    return <EmptyState title="Ticket not found" body="It may have been removed, or you do not have access." />;
  }

  const isAssignee = user?.id === ticket.assignedAgentId;
  const canStaff = user?.role === "AGENT" || user?.role === "ADMIN";
  const canMutate = user?.role === "ADMIN" || isAssignee;
  const completed = isCompleted(ticket.status);
  const isCustomer = user?.role === "CUSTOMER";
  const showWorkerSelection = isCustomer && isNew(ticket.status) && !ticket.assignedAgentId;
  const showRatingForm =
    isCustomer && completed && Boolean(ticket.assignedAgentId) && !ticket.workerRating;
  const suggestedIds = Array.isArray(ticket.suggestedWorkerIds)
    ? (ticket.suggestedWorkerIds as string[])
    : undefined;
  const urgency = ticket.priority || normalizePriority(ticket.aiPriority) || "Pending";
  const timelineEvents = buildTimelineEvents(ticket);

  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <p className="text-sm text-muted">
          <Link href={user ? ticketsPath(user.role) : "/login"} className="hover:text-white">
            Tickets
          </Link>
          <span className="mx-2 text-white/20">/</span>
          {ticket.ticketNumber}
        </p>
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-white md:text-4xl">{ticket.subject}</h1>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted">{ticket.description}</p>
        </div>
        <TicketInfoPills
          pills={[
            { icon: ticketPillIcons.ticket, label: "Ticket #", value: ticket.ticketNumber },
            { icon: ticketPillIcons.category, label: "Category", value: ticket.category || ticket.aiCategory || "Pending" },
            { icon: ticketPillIcons.worker, label: "Assigned worker", value: ticket.assignedAgent?.name ?? "Unassigned" },
            { icon: ticketPillIcons.urgency, label: "Urgency", value: String(urgency) },
          ]}
          statusPill={statusLabel(ticket.status, isCustomer)}
        />
      </div>

      <TicketTimeline events={timelineEvents} />

      {isCustomer && (ticket.aiPriority || ticket.aiCategory || ticket.aiSummary) ? (
        <AiTriageSuggestion
          compact
          suggestion={{
            ok: true,
            category: ticket.aiCategory ?? ticket.category,
            priority: ticket.aiPriority,
            summary: ticket.aiSummary,
          }}
        />
      ) : null}

      {showWorkerSelection && accessToken ? (
        <WorkerSelectionPanel
          accessToken={accessToken}
          suggestedIds={suggestedIds}
          selectingId={selectingWorkerId}
          onSelect={(workerId) => void selectWorker(workerId)}
        />
      ) : null}

      {showRatingForm && accessToken ? (
        <WorkerRatingPanel
          ticket={ticket}
          accessToken={accessToken}
          onSubmitted={(next, rating) =>
            setTicket((prev) =>
              prev
                ? mergeTicketUpdate(prev, {
                    ...next,
                    workerRating: { id: rating.id, stars: rating.stars, comment: rating.comment },
                    messages: prev.messages,
                  })
                : next,
            )
          }
        />
      ) : null}

    <div className="grid gap-5 xl:grid-cols-[1fr_340px]">
      <Glass className="flex min-h-[70vh] flex-col overflow-hidden">
        <div className="border-b border-white/10 p-5">
          <p className="text-xs uppercase tracking-[0.16em] text-muted">Conversation</p>
          {isCustomer && ticket.aiSummary ? (
            <p className="mt-3 rounded-xl bg-white/[0.04] p-3 text-sm text-muted">{ticket.aiSummary}</p>
          ) : null}
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto p-5">
          {(ticket.messages ?? []).map((message) => {
            const mine = message.senderId === user?.id;
            return (
              <div key={message.id} className={cn("flex gap-3", mine ? "flex-row-reverse" : "")}>
                <Avatar name={message.sender?.name ?? "Solace"} hue={message.sender?.avatarHue ?? 170} size="sm" />
                <div
                  className={cn(
                    "max-w-[78%] px-3.5 py-2.5 text-sm leading-relaxed",
                    mine
                      ? "rounded-[1.1rem_1.1rem_0.35rem_1.1rem] bg-accent text-white"
                      : "rounded-[1.1rem_1.1rem_1.1rem_0.35rem] bg-white/[0.07] text-white",
                  )}
                >
                  <p className={cn("mb-1 text-[10px] uppercase tracking-wider", mine ? "text-white/70" : "text-muted")}>
                    {message.sender?.name}
                  </p>
                  <p className="whitespace-pre-wrap">{message.body}</p>
                </div>
              </div>
            );
          })}
          {typingName ? <p className="text-xs text-white/45">{typingName} is typing…</p> : null}
          <div ref={bottomRef} />
        </div>

        <div className="border-t border-white/10 p-4">
          {completed ? (
            <p className="text-sm text-white/40">
              {isCustomer
                ? ticket.workerRating
                  ? "Completed. Thanks for your review!"
                  : "Completed. Rate your worker below — your review helps others choose support."
                : "Completed. Reopen the ticket to keep talking."}
            </p>
          ) : (
            <div className="flex gap-2">
              <Textarea
                rows={3}
                value={draft}
                placeholder={isCustomer ? "Add an update for the agent…" : "Write a reply…"}
                onChange={(e) => {
                  setDraft(e.target.value);
                  socket?.emit("typing", { ticketId: id, typing: e.target.value.length > 0 });
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void send();
                  }
                }}
              />
              <Button
                variant="pill"
                className="self-end px-4"
                aria-label="Send message"
                disabled={busy || !draft.trim()}
                onClick={() => void send()}
              >
                <Send size={15} />
              </Button>
            </div>
          )}
        </div>
      </Glass>

      <div className="space-y-4">
        <Glass className="p-5">
          <h2 className="text-sm font-medium">{isCustomer ? "Who is on this ticket" : "People"}</h2>
          <div className="mt-3 space-y-2 text-sm text-white/60">
            <p>{isCustomer ? "You" : "Customer"} · {ticket.customer?.name}</p>
            <p>Agent · {ticket.assignedAgent?.name ?? (isCustomer ? "Waiting for an agent" : "Unclaimed")}</p>
          </div>
          {canStaff && isNew(ticket.status) && !ticket.assignedAgentId ? (
            <Button variant="pill" className="mt-4 w-full" onClick={() => void patchTicket(`/tickets/${id}/assign`)}>
              Claim ticket
            </Button>
          ) : null}
        </Glass>

        {isCustomer && ticket.workerRating ? <WorkerRatingSubmitted ticket={ticket} /> : null}

        {canMutate ? (
          <Glass className="p-5">
            <h2 className="text-sm font-medium">Status</h2>
            <div className="mt-3">
              <StatusBadge status={ticket.status} />
            </div>
            <Field label="Resolution note">
              <Textarea
                rows={3}
                className="mt-2"
                value={resolutionNote}
                onChange={(e) => setResolutionNote(e.target.value)}
                placeholder="Required to mark completed"
              />
            </Field>
            {isAccepted(ticket.status) ? (
              <Button variant="pill" className="mt-3 w-full" onClick={() => void advanceStatus("InProgress")}>
                Start work
              </Button>
            ) : null}
            {isInProgress(ticket.status) ? (
              <>
                <Button variant="ghost" className="mt-2 w-full" disabled={!!aiBusy} onClick={() => void draftResolution()}>
                  {aiBusy === "resolve" ? (
                    <span className="inline-flex items-center gap-2">
                      <LoaderCircle size={14} className="animate-spin" />
                      Analyzing ticket...
                    </span>
                  ) : (
                    "Draft resolution with AI"
                  )}
                </Button>
                <Button
                  variant="pill"
                  className="mt-3 w-full"
                  disabled={!resolutionNote.trim()}
                  onClick={() => void advanceStatus("Completed")}
                >
                  Mark completed
                </Button>
              </>
            ) : null}
            {completed ? (
              <Button variant="ghost" className="mt-3 w-full" onClick={() => void patchTicket(`/tickets/${id}/status`, { status: "InProgress" })}>
                Reopen
              </Button>
            ) : null}
          </Glass>
        ) : null}

        {canStaff ? (
          <AiReviewCard
            ticket={ticket}
            category={aiCategory}
            priority={aiPriority}
            summary={aiSummary}
            editing={editing}
            aiBusy={aiBusy}
            onChangeCategory={setAiCategory}
            onChangePriority={setAiPriority}
            onChangeSummary={setAiSummary}
            onApprove={approveField}
            onReject={rejectField}
            onSave={() => void acceptAi()}
            onRegenerate={() => void regenerate()}
          />
        ) : null}

        {actionError ? <p className="text-sm text-rose-300">{actionError}</p> : null}
      </div>
    </div>
    </div>
  );
}
