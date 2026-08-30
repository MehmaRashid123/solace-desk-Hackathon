"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { endpoints } from "@/lib/api";
import { useAuth } from "./AuthContext";

type SocketContextValue = {
  socket: Socket | null;
  connected: boolean;
};

const SocketContext = createContext<SocketContextValue>({ socket: null, connected: false });

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const { accessToken } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!accessToken) {
      setSocket(null);
      setConnected(false);
      return;
    }

    const next = io(`${endpoints.socket}/tickets`, {
      auth: { token: accessToken },
      withCredentials: true,
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 600,
    });

    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);
    next.on("connect", onConnect);
    next.on("disconnect", onDisconnect);
    setSocket(next);

    return () => {
      next.off("connect", onConnect);
      next.off("disconnect", onDisconnect);
      next.disconnect();
    };
  }, [accessToken]);

  const value = useMemo(() => ({ socket, connected }), [socket, connected]);
  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
}

export function useSocket() {
  return useContext(SocketContext);
}
