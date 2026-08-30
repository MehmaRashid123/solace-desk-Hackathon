"use client";

import { AuthProvider } from "@/context/AuthContext";
import { SocketProvider } from "@/context/SocketContext";
import { ToastProvider } from "@/context/ToastContext";
import { NoticeProvider } from "@/context/NoticeContext";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <SocketProvider>
        <NoticeProvider>
          <ToastProvider>{children}</ToastProvider>
        </NoticeProvider>
      </SocketProvider>
    </AuthProvider>
  );
}
