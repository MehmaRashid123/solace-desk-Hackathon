"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api, ApiError, onSessionRefresh } from "@/lib/api";
import type { PublicUser } from "@/lib/types";

type AuthContextValue = {
  user: PublicUser | null;
  accessToken: string | null;
  ready: boolean;
  login: (email: string, password: string) => Promise<PublicUser>;
  register: (name: string, email: string, password: string, role?: "CUSTOMER" | "AGENT") => Promise<PublicUser>;
  logout: () => Promise<void>;
  updateProfile: (body: {
    name?: string;
    avatarHue?: number;
    currentPassword?: string;
    newPassword?: string;
  }) => Promise<PublicUser>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  const applySession = useCallback((session: { accessToken: string; user?: PublicUser | null }) => {
    setAccessToken(session.accessToken);
    if (session.user) setUser(session.user);
  }, []);

  useEffect(() => {
    onSessionRefresh((session) => applySession(session as { accessToken: string; user?: PublicUser }));
    return () => onSessionRefresh(null);
  }, [applySession]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const session = await api<{ accessToken: string; user: PublicUser }>("/auth/refresh", {
          method: "POST",
        });
        if (!cancelled) applySession(session);
      } catch {
        if (!cancelled) {
          setUser(null);
          setAccessToken(null);
        }
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [applySession]);

  const login = useCallback(
    async (email: string, password: string) => {
      const session = await api<{ accessToken: string; user: PublicUser }>("/auth/login", {
        method: "POST",
        body: { email, password },
      });
      applySession(session);
      return session.user;
    },
    [applySession],
  );

  const register = useCallback(
    async (name: string, email: string, password: string, role: "CUSTOMER" | "AGENT" = "CUSTOMER") => {
      const session = await api<{ accessToken: string; user: PublicUser }>("/auth/register", {
        method: "POST",
        body: { name, email, password, role },
      });
      applySession(session);
      return session.user;
    },
    [applySession],
  );

  const logout = useCallback(async () => {
    try {
      await api("/auth/logout", { method: "POST", token: accessToken });
    } catch (err) {
      if (!(err instanceof ApiError)) throw err;
    }
    setUser(null);
    setAccessToken(null);
  }, [accessToken]);

  const updateProfile = useCallback(
    async (body: {
      name?: string;
      avatarHue?: number;
      currentPassword?: string;
      newPassword?: string;
    }) => {
      if (!accessToken) throw new Error("Not signed in");
      const session = await api<{ user: PublicUser }>("/auth/me", {
        method: "PATCH",
        token: accessToken,
        body,
      });
      setUser(session.user);
      return session.user;
    },
    [accessToken],
  );

  const value = useMemo(
    () => ({ user, accessToken, ready, login, register, logout, updateProfile }),
    [user, accessToken, ready, login, register, logout, updateProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
