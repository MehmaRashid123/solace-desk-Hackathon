"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Columns3, SlidersHorizontal, Table2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useSocket } from "@/context/SocketContext";
import { api } from "@/lib/api";
import { CATEGORIES, relativeTime } from "@/lib/format";
import type { Stats, Ticket, TicketPriority, TicketStatus } from "@/lib/types";
import { Button, EmptyState, Glass, PriorityChip, Select, Skeleton, StatusBadge } from "@/components/ui";
import { PageToolbar } from "@/components/AppShell";
import { IncomingBookings } from "@/components/IncomingBookings";
import { DonutStat } from "@/components/DonutStat";
import { StatCard, trendFromPercent } from "@/components/StatCard";
import { TicketFlow } from "@/components/TicketFlow";
import {
  categoryDonutSegments,
  formatResolutionMinutes,
  prioritySparkline,
  resolutionSparkline,
  sparklineFromDailyCounts,
  workerResponseSegments,
} from "@/lib/statCards";
import { cn } from "@/lib/cn";
import { ticketDetailPath } from "@/lib/routes";
import { useToast } from "@/context/ToastContext";

import { isNew, KANBAN_COLUMNS, STATUS_FILTER_OPTIONS } from "@/lib/ticketStatus";

export default function DashboardPage() {
  const { user, accessToken } = useAuth();
  const { socket } = useSocket();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [status, setStatus] = useState<TicketStatus | "ALL">("ALL");
  const [priority, setPriority] = useState<TicketPriority | "ALL">("ALL");
  const [category, setCategory] = useState("ALL");
  const [assignment, setAssignment] = useState<"ALL" | "UNASSIGNED">("ALL");
  const [view, setView] = useState<"kanban" | "table">("kanban");
  const [showFilters, setShowFilters] = useState(true);
  const [loading, setLoading] = useState(true);
  const [bookingBusyId, setBookingBusyId] = useState<string | null>(null);
  const { toast } = useToast();

  function load() {
    if (!accessToken) return;
    setLoading(true);
    Promise.all([
      api<{ tickets: Ticket[] }>("/tickets", { token: accessToken }).then((r) => setTickets(r.tickets)),
      api<{ stats: Stats }>("/stats", { token: accessToken }).then((r) => setStats(r.stats)),
    ])
      .catch((err) => toast(err instanceof Error ? err.message : "Could not load dashboard"))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, user?.role]);

  useEffect(() => {
    if (!socket) return;
    const join = () => socket.emit("dashboard:join");
    join();
    socket.on("connect", join);
    const onChange = (ticket: Ticket) => {
      setTickets((prev) => {
        if (user?.role === "AGENT" && ticket.assignedAgentId && ticket.assignedAgentId !== user.id) {
          return prev.filter((row) => row.id !== ticket.id);
        }
        const i = prev.findIndex((t) => t.id === ticket.id);
        if (i === -1) return [ticket, ...prev];
        const next = [...prev];
        next[i] = { ...next[i], ...ticket };
        return next;
      });
      if (accessToken) {
        void api<{ stats: Stats }>("/stats", { token: accessToken }).then((r) => setStats(r.stats));
      }
    };
    socket.on("ticket:statusChanged", onChange);
    socket.on("ticket:assigned", onChange);
    return () => {
      socket.off("connect", join);
      socket.emit("dashboard:leave");
      socket.off("ticket:statusChanged", onChange);
      socket.off("ticket:assigned", onChange);
    };
  }, [socket, user?.role, user?.id, accessToken]);

  const visible = useMemo(
    () =>
      tickets.filter((t) => {
        if (status !== "ALL" && t.status !== status) return false;
        if (priority !== "ALL" && t.priority !== priority) return false;
        if (category !== "ALL" && t.category !== category) return false;
        if (assignment === "UNASSIGNED" && t.assignedAgentId) return false;
        return true;
      }),
    [tickets, status, priority, category, assignment],
  );

  async function acceptBooking(ticketId: string, urgency: TicketPriority) {
    if (!accessToken) return;
    setBookingBusyId(ticketId);
    try {
      const { ticket } = await api<{ ticket: Ticket }>(`/tickets/${ticketId}/respond`, {
        method: "PATCH",
        token: accessToken,
        body: { action: "accept", urgency },
      });
      setTickets((prev) => {
        const i = prev.findIndex((t) => t.id === ticket.id);
        if (i === -1) return [ticket, ...prev];
        const next = [...prev];
        next[i] = { ...next[i], ...ticket };
        return next;
      });
      toast("Booking accepted", "ok");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not accept booking");
    } finally {
      setBookingBusyId(null);
    }
  }

  async function rejectBooking(ticketId: string, rejectionReason: string) {
    if (!accessToken) return;
    setBookingBusyId(ticketId);
    try {
      const { ticket } = await api<{ ticket: Ticket }>(`/tickets/${ticketId}/respond`, {
        method: "PATCH",
        token: accessToken,
        body: { action: "reject", rejectionReason },
      });
      setTickets((prev) => {
        const i = prev.findIndex((t) => t.id === ticket.id);
        if (i === -1) return prev;
        const next = [...prev];
        next[i] = { ...next[i], ...ticket };
        return next;
      });
      toast("Booking declined", "ok");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not decline booking");
    } finally {
      setBookingBusyId(null);
    }
  }

  async function claim(ticketId: string) {
    if (!accessToken) return;
    try {
      const { ticket } = await api<{ ticket: Ticket }>(`/tickets/${ticketId}/assign`, {
        method: "PATCH",
        token: accessToken,
      });
      setTickets((prev) => {
        const i = prev.findIndex((t) => t.id === ticket.id);
        if (i === -1) return [ticket, ...prev];
        const next = [...prev];
        next[i] = { ...next[i], ...ticket };
        return next;
      });
      toast("Ticket claimed", "ok");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not claim ticket");
    }
  }

  const highPriorityCount = stats?.highPriorityCount ?? tickets.filter((t) => t.priority === "HIGH").length;
  const normalPriorityCount =
    stats?.normalPriorityCount ?? tickets.filter((t) => t.priority === "LOW" || t.priority === "MEDIUM").length;
  const avgResolutionMinutes = stats?.avgResolutionTimeMinutes ?? (stats?.avgResolutionHours ?? 0) * 60;
  const highSparkline = stats?.ticketsPerDay?.length
    ? sparklineFromDailyCounts(stats.ticketsPerDay)
    : prioritySparkline(tickets, "HIGH");
  const normalSparkline = prioritySparkline(tickets, "NORMAL");
  const resolutionSparklineData = resolutionSparkline(tickets);
  const categorySegments = categoryDonutSegments(stats?.categoryBreakdown, tickets);
  const categoryTotal = categorySegments.reduce((sum, segment) => sum + segment.value, 0);
  const workerSegments = workerResponseSegments(stats?.workerResponseRate);
  const workerTotal = workerSegments.reduce((sum, segment) => sum + segment.value, 0);
  return (
    <div className="space-y-5">
      <PageToolbar
        title="Dashboard"
        subtitle="Follow tickets from ingestion to resolution."
        onRefresh={load}
        extra={
          <button
            type="button"
            onClick={() => setShowFilters((v) => !v)}
            className="inline-flex items-center gap-2 rounded-full border border-white/10 px-4 py-2.5 text-sm text-white/70 hover:bg-white/5"
          >
            <SlidersHorizontal size={14} />
            Filters
          </button>
        }
      />

      {loading && !stats ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-40" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
          <StatCard
            label="High Priority Tickets"
            value={highPriorityCount}
            trendPercent={stats?.highPriorityTrend}
            trendDirection={trendFromPercent(stats?.highPriorityTrend)}
            sparklineData={highSparkline}
          />
          <StatCard
            label="Normal Priority Tickets"
            value={normalPriorityCount}
            trendPercent={stats?.normalPriorityTrend}
            trendDirection={trendFromPercent(stats?.normalPriorityTrend)}
            sparklineData={normalSparkline}
          />
          <StatCard
            label="Avg Resolution Time"
            value={formatResolutionMinutes(avgResolutionMinutes)}
            trendPercent={stats?.avgResolutionTrend}
            trendDirection={trendFromPercent(stats?.avgResolutionTrend)}
            invertTrend
            sparklineData={resolutionSparklineData}
          />
          <Glass className="p-5">
            <p className="mb-1 text-[11px] text-white/40">Category breakdown</p>
            <DonutStat total={categoryTotal} centerLabel="Total tickets" segments={categorySegments} />
          </Glass>
          <Glass className="p-5">
            <p className="mb-1 text-[11px] text-white/40">Worker response rate</p>
            <DonutStat total={workerTotal} centerLabel="AI reviews" segments={workerSegments} />
          </Glass>
        </div>
      )}

      <IncomingBookings
        tickets={tickets}
        busyId={bookingBusyId}
        onAccept={acceptBooking}
        onReject={rejectBooking}
      />

      <TicketFlow flowCounts={stats?.flowCounts} categoryBreakdown={stats?.categoryBreakdown} tickets={tickets} />

      {showFilters ? (
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="grid min-w-0 flex-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Select value={assignment} onChange={(e) => setAssignment(e.target.value as "ALL" | "UNASSIGNED")}>
              <option value="ALL">All tickets</option>
              <option value="UNASSIGNED">Unassigned</option>
            </Select>
            <Select value={status} onChange={(e) => setStatus(e.target.value as TicketStatus | "ALL")}>
              <option value="ALL">All statuses</option>
              {STATUS_FILTER_OPTIONS.filter((s) => s !== "ALL").map((s) => (
                <option key={s} value={s}>
                  {s.replace(/([a-z])([A-Z])/g, " $1 $2")}
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
          <div className="flex rounded-full bg-white/[0.04] p-1 ring-1 ring-white/10">
            {(
              [
                { id: "kanban" as const, label: "Kanban", icon: Columns3 },
                { id: "table" as const, label: "Table", icon: Table2 },
              ]
            ).map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setView(option.id)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium",
                  view === option.id ? "bg-accent text-white" : "text-muted hover:text-white",
                )}
              >
                <option.icon size={13} />
                {option.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {view === "kanban" ? (
        <div className="grid gap-3 xl:grid-cols-4">
          {KANBAN_COLUMNS.map((col) => (
            <div key={col} className="min-w-0">
              <p className="mb-2 text-[11px] uppercase tracking-[0.16em] text-white/35">{col.replace(/([a-z])([A-Z])/g, " $1 $2")}</p>
              <div className="space-y-2">
                {visible
                  .filter((t) => t.status === col)
                  .map((ticket) => (
                    <Glass key={ticket.id} className="p-3 hover:bg-white/[0.03]">
                      <Link href={ticketDetailPath(user!.role, ticket.id)} className="block">
                        <p className="text-[11px] text-white/35">{ticket.ticketNumber}</p>
                        <p className="mt-1 truncate text-sm">{ticket.subject}</p>
                        <div className="mt-2 flex items-center justify-between">
                          <PriorityChip priority={ticket.priority} />
                          <StatusBadge status={ticket.status} />
                        </div>
                      </Link>
                      {!ticket.assignedAgentId && isNew(ticket.status) ? (
                        <Button variant="pill" className="mt-3 w-full py-1.5 text-xs" onClick={() => void claim(ticket.id)}>
                          Claim
                        </Button>
                      ) : null}
                    </Glass>
                  ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <>
          <div className="space-y-2 md:hidden">
            {visible.map((ticket) => (
              <Glass key={ticket.id} className="p-3">
                <Link href={ticketDetailPath(user!.role, ticket.id)} className="block">
                  <p className="text-[11px] text-white/35">{ticket.ticketNumber}</p>
                  <p className="mt-1 text-sm">{ticket.subject}</p>
                </Link>
                {!ticket.assignedAgentId && isNew(ticket.status) ? (
                  <Button variant="pill" className="mt-3 w-full py-1.5 text-xs" onClick={() => void claim(ticket.id)}>
                    Claim
                  </Button>
                ) : null}
              </Glass>
            ))}
          </div>
          <Glass className="hidden overflow-x-auto md:block">
            <table className="min-w-full text-left text-sm">
              <thead className="text-[11px] uppercase tracking-[0.14em] text-white/35">
                <tr>
                  <th className="px-4 py-3 font-medium">Ticket</th>
                  <th className="px-4 py-3 font-medium">Subject</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Priority</th>
                  <th className="px-4 py-3 font-medium">Updated</th>
                  <th className="px-4 py-3 font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((ticket) => (
                  <tr key={ticket.id} className="border-t border-white/10">
                    <td className="px-4 py-3 text-white/45">{ticket.ticketNumber}</td>
                    <td className="px-4 py-3">
                      <Link href={ticketDetailPath(user!.role, ticket.id)}>{ticket.subject}</Link>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={ticket.status} />
                    </td>
                    <td className="px-4 py-3">
                      <PriorityChip priority={ticket.priority} />
                    </td>
                    <td className="px-4 py-3 text-white/40">{relativeTime(ticket.updatedAt)}</td>
                    <td className="px-4 py-3">
                      {!ticket.assignedAgentId && isNew(ticket.status) ? (
                        <Button variant="pill" className="px-3 py-1 text-xs" onClick={() => void claim(ticket.id)}>
                          Claim
                        </Button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Glass>
        </>
      )}

      {!loading && visible.length === 0 ? (
        <EmptyState title="No tickets in this view" body="Switch to All tickets, or wait for a customer to open one." />
      ) : null}
    </div>
  );
}
