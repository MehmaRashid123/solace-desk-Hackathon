"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useSocket } from "@/context/SocketContext";
import { api } from "@/lib/api";
import { unwrapTicketList } from "@/lib/apiHelpers";
import { CATEGORIES, statusLabel } from "@/lib/format";
import type { Ticket, TicketPriority, TicketStatus } from "@/lib/types";
import { listenTicketList } from "@/lib/liveTickets";
import { STATUS_FILTER_OPTIONS } from "@/lib/ticketStatus";
import { TicketCard } from "@/components/TicketCard";
import { CustomerHome } from "@/components/CustomerHome";
import { Button, EmptyState, Select, Skeleton } from "@/components/ui";
import { PageToolbar } from "@/components/AppShell";
import { useToast } from "@/context/ToastContext";
import { RefreshCw } from "lucide-react";

export default function TicketsPage() {
  const { user, accessToken } = useAuth();
  const { socket } = useSocket();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [status, setStatus] = useState<TicketStatus | "ALL">("ALL");
  const [priority, setPriority] = useState<TicketPriority | "ALL">("ALL");
  const [category, setCategory] = useState("ALL");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const load = useCallback(() => {
    if (!accessToken) return;
    setLoading(true);
    setError(null);
    const path = user?.role === "CUSTOMER" ? "/tickets/mine" : "/tickets";
    void api<{ tickets: Ticket[] }>(path, { token: accessToken })
      .then((r) => setTickets(unwrapTicketList(r)))
      .catch((err) => {
        const message = err instanceof Error ? err.message : "Could not load tickets";
        setError(message);
        toast(message);
      })
      .finally(() => setLoading(false));
  }, [accessToken, user?.role, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const ticketIds = tickets.map((t) => t.id).join(",");

  useEffect(() => {
    if (!socket) return;
    const stop = listenTicketList(socket, setTickets, {
      filter: user?.role === "AGENT" ? (ticket) => !ticket.assignedAgentId || ticket.assignedAgentId === user.id : undefined,
    });
    if (user?.role === "CUSTOMER") {
      const ids = ticketIds ? ticketIds.split(",") : [];
      const joinRooms = () => ids.forEach((id) => socket.emit("ticket:join", id));
      joinRooms();
      socket.on("connect", joinRooms);
      return () => {
        socket.off("connect", joinRooms);
        ids.forEach((id) => socket.emit("ticket:leave", id));
        stop();
      };
    }
    const joinDash = () => socket.emit("dashboard:join");
    joinDash();
    socket.on("connect", joinDash);
    return () => {
      socket.off("connect", joinDash);
      socket.emit("dashboard:leave");
      stop();
    };
  }, [socket, user?.role, user?.id, ticketIds]);

  const visible = useMemo(
    () =>
      tickets.filter((t) => {
        if (status !== "ALL" && t.status !== status) return false;
        if (priority !== "ALL" && t.priority !== priority) return false;
        if (category !== "ALL" && t.category !== category) return false;
        return true;
      }),
    [tickets, status, priority, category],
  );

  if (user?.role === "CUSTOMER") {
    return (
      <CustomerHome
        title="Tickets"
        subtitle="Every request you have opened."
        tickets={tickets}
        visible={visible}
        status={status}
        setStatus={setStatus}
        loading={loading}
      />
    );
  }

  if (error && !tickets.length) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4 text-center">
        <p className="max-w-sm text-secondary">{error}</p>
        <Button variant="pill" onClick={load}>
          <RefreshCw size={15} />
          Try again
        </Button>
      </div>
    );
  }

  return (
    <div>
      <PageToolbar title="Tickets" subtitle="Unassigned tickets and the ones in your scope." onRefresh={load} />
      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <Select value={status} onChange={(e) => setStatus(e.target.value as TicketStatus | "ALL")}>
          {STATUS_FILTER_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s === "ALL" ? "All statuses" : statusLabel(s)}
            </option>
          ))}
        </Select>
        <Select value={priority} onChange={(e) => setPriority(e.target.value as TicketPriority | "ALL")}>
          <option value="ALL">All priorities</option>
          <option value="LOW">Low</option>
          <option value="MEDIUM">Medium</option>
          <option value="HIGH">High</option>
        </Select>
        <Select value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="ALL">All categories</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </Select>
      </div>
      {loading
        ? Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="mb-2 h-24" />)
        : visible.map((ticket) => <TicketCard key={ticket.id} ticket={ticket} audience="agent" />)}
      {!loading && visible.length === 0 ? (
        tickets.length === 0 ? (
          <EmptyState title="No tickets yet" body="New customer tickets land here for claim." />
        ) : (
          <EmptyState title="No tickets in this lane" body="Switch the status, priority, or category filter." />
        )
      ) : null}
      {error && tickets.length ? (
        <p className="mt-4 text-center text-sm text-danger">
          {error}{" "}
          <button type="button" className="underline hover:text-primary" onClick={load}>
            Retry
          </button>
        </p>
      ) : null}
    </div>
  );
}
