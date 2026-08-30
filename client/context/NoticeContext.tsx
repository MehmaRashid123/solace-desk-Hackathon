"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useAuth } from "./AuthContext";
import { useSocket } from "./SocketContext";
import { api } from "@/lib/api";
import type { Ticket } from "@/lib/types";
import { isNew } from "@/lib/ticketStatus";

export type Notice = {
  id: string;
  title: string;
  body: string;
  ticketId?: string;
  at: number;
  read: boolean;
  kind: "status" | "booking" | "admin" | "review";
};

type NoticeContextValue = {
  notices: Notice[];
  unreadNotifications: number;
  markAllRead: () => void;
};

const NoticeContext = createContext<NoticeContextValue>({
  notices: [],
  unreadNotifications: 0,
  markAllRead: () => undefined,
});

export function NoticeProvider({ children }: { children: React.ReactNode }) {
  const { user, accessToken } = useAuth();
  const { socket } = useSocket();
  const [notices, setNotices] = useState<Notice[]>([]);

  const push = useCallback((notice: Omit<Notice, "id" | "at" | "read">) => {
    setNotices((prev) => [{ ...notice, id: `${Date.now()}-${Math.random()}`, at: Date.now(), read: false }, ...prev].slice(0, 20));
  }, []);

  useEffect(() => {
    if (!socket || !user) return;
    const joinDash = () => {
      if (user.role === "AGENT" || user.role === "ADMIN") socket.emit("dashboard:join");
    };
    joinDash();
    socket.on("connect", joinDash);

    const onStatus = (ticket: Ticket) => {
      if (user.role === "AGENT") {
        if (ticket.assignedAgentId && ticket.assignedAgentId !== user.id) return;
      }
      if (user.role === "CUSTOMER" && ticket.status === "Completed" && !ticket.workerRating) {
        push({
          kind: "status",
          title: "Ticket completed — rate your worker",
          body: ticket.subject,
          ticketId: ticket.id,
        });
        return;
      }
      push({
        kind: "status",
        title: `Status · ${ticket.status.replace(/([a-z])([A-Z])/g, " $1 $2")}`,
        body: ticket.subject,
        ticketId: ticket.id,
      });
    };

    const onNewBooking = (ticket: Ticket) => {
      if (user.role !== "AGENT") return;
      if (ticket.assignedAgentId !== user.id) return;
      push({
        kind: "booking",
        title: "New booking",
        body: ticket.subject,
        ticketId: ticket.id,
      });
    };

    const onAdminWorkerSelected = (ticket: Ticket) => {
      if (user.role !== "ADMIN") return;
      const workerName = ticket.assignedAgent?.name ?? "A worker";
      const customerName = ticket.customer?.name ?? "Customer";
      push({
        kind: "admin",
        title: "Worker selected",
        body: `${customerName} chose ${workerName} · ${ticket.subject}`,
        ticketId: ticket.id,
      });
    };

    const onWorkerReview = (payload: {
      workerId: string;
      review: { stars: number; comment: string | null; customerName: string };
    }) => {
      if (user.role !== "AGENT" || payload.workerId !== user.id) return;
      const stars = "★".repeat(payload.review.stars);
      push({
        kind: "review",
        title: "New customer review",
        body: `${payload.review.customerName} rated you ${stars}${payload.review.comment ? ` — ${payload.review.comment}` : ""}`,
      });
    };

    const onAssigned = (ticket: Ticket) => {
      if (user.role !== "AGENT") return;
      if (isNew(ticket.status) && !ticket.assignedAgentId) {
        onNewBooking(ticket);
      }
    };

    socket.on("ticket:statusChanged", onStatus);
    socket.on("ticket:assigned", onAssigned);
    socket.on("worker:newBooking", onNewBooking);
    socket.on("admin:workerSelected", onAdminWorkerSelected);
    socket.on("worker:newReview", onWorkerReview);
    return () => {
      socket.off("connect", joinDash);
      socket.off("ticket:statusChanged", onStatus);
      socket.off("ticket:assigned", onAssigned);
      socket.off("worker:newBooking", onNewBooking);
      socket.off("admin:workerSelected", onAdminWorkerSelected);
      socket.off("worker:newReview", onWorkerReview);
    };
  }, [socket, user, push]);

  useEffect(() => {
    if (!socket || !accessToken || user?.role !== "CUSTOMER") return;
    let ids: string[] = [];
    void api<{ tickets: Ticket[] }>("/tickets/mine", { token: accessToken }).then((r) => {
      ids = r.tickets.map((t) => t.id);
      ids.forEach((id) => socket.emit("ticket:join", id));
    });
    return () => {
      ids.forEach((id) => socket.emit("ticket:leave", id));
    };
  }, [socket, accessToken, user?.role]);

  const markAllRead = useCallback(() => {
    setNotices((prev) => prev.map((item) => ({ ...item, read: true })));
  }, []);

  const unreadNotifications = notices.filter((n) => !n.read).length;

  const value = useMemo(
    () => ({ notices, unreadNotifications, markAllRead }),
    [notices, unreadNotifications, markAllRead],
  );

  return <NoticeContext.Provider value={value}>{children}</NoticeContext.Provider>;
}

export function useNotices() {
  return useContext(NoticeContext);
}
