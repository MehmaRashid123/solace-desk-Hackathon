"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { IncomingBookings } from "@/components/IncomingBookings";
import { PageToolbar } from "@/components/DashboardLayout";
import { useAuth } from "@/context/AuthContext";
import { useSocket } from "@/context/SocketContext";
import { api } from "@/lib/api";
import { listenTicketList } from "@/lib/liveTickets";
import type { Ticket, TicketPriority } from "@/lib/types";
import { useToast } from "@/context/ToastContext";
import { Button, Skeleton } from "@/components/ui";

export default function WorkerBookingsPage() {
  const { accessToken } = useAuth();
  const { socket } = useSocket();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [bookingBusyId, setBookingBusyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const load = useCallback(() => {
    if (!accessToken) return;
    setLoading(true);
    setError(null);
    void api<{ tickets: Ticket[] }>("/tickets/mine", { token: accessToken })
      .then((r) => setTickets(r.tickets))
      .catch((err) => {
        const message = err instanceof Error ? err.message : "Could not load bookings";
        setError(message);
        toast(message);
      })
      .finally(() => setLoading(false));
  }, [accessToken, toast]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!socket) return;
    const stop = listenTicketList(socket, setTickets, {
      filter: (ticket) => Boolean(ticket.assignedAgentId),
    });
    const joinDash = () => socket.emit("dashboard:join");
    joinDash();
    socket.on("connect", joinDash);
    return () => {
      socket.off("connect", joinDash);
      socket.emit("dashboard:leave");
      stop();
    };
  }, [socket]);

  async function acceptBooking(ticketId: string, urgency: TicketPriority) {
    if (!accessToken) return;
    setBookingBusyId(ticketId);
    try {
      const { ticket } = await api<{ ticket: Ticket }>(`/tickets/${ticketId}/respond`, {
        method: "PATCH",
        token: accessToken,
        body: { action: "accept", urgency },
      });
      setTickets((prev) => prev.map((t) => (t.id === ticket.id ? { ...t, ...ticket } : t)));
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
      setTickets((prev) => prev.map((t) => (t.id === ticket.id ? { ...t, ...ticket } : t)));
      toast("Booking declined", "ok");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not decline booking");
    } finally {
      setBookingBusyId(null);
    }
  }

  return (
    <div className="space-y-5">
      <PageToolbar title="Incoming bookings" subtitle="Respond to customers who selected you as their worker." onRefresh={load} />
      {error && !tickets.length ? (
        <div className="flex flex-col items-center gap-3 py-10 text-center">
          <p className="text-sm text-secondary">{error}</p>
          <Button variant="pill" onClick={load}>
            <RefreshCw size={15} />
            Try again
          </Button>
        </div>
      ) : null}
      {loading ? <Skeleton className="h-48" /> : null}
      {!loading ? <IncomingBookings tickets={tickets} busyId={bookingBusyId} onAccept={acceptBooking} onReject={rejectBooking} /> : null}
    </div>
  );
}
