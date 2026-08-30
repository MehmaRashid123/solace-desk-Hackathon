"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Bell, ChevronDown, LogOut, Menu, Search, Settings, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useNotices } from "@/context/NoticeContext";
import { api } from "@/lib/api";
import { APP_NAME } from "@/lib/brand";
import { dashboardPath, profilePath, ticketDetailPath, ticketsPath } from "@/lib/routes";
import type { Ticket } from "@/lib/types";
import { cn } from "@/lib/cn";
import { Avatar, Input, LogoBadge } from "./ui";

export type TopBarTab = {
  href: string;
  label: string;
  match: (path: string) => boolean;
};

export type TopBarProps = {
  /** Role-aware navigation tabs for the center pill nav. */
  tabs: TopBarTab[];
  /** Shows a red dot on the notification bell when true. */
  hasUnread?: boolean;
};

export function TopBar({ tabs, hasUnread = false }: TopBarProps) {
  const { user } = useAuth();
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-30 border-b border-card bg-page/90 backdrop-blur-xl">
      <div className="mx-auto flex max-w-[1440px] items-center gap-4 px-4 py-3 md:px-6">
        <Link href={user ? dashboardPath(user.role) : "/login"} className="flex shrink-0 items-center gap-2.5">
          <LogoBadge />
          <span className="text-[15px] font-semibold tracking-wide text-primary">{APP_NAME}</span>
        </Link>

        <MobileNavMenu tabs={tabs} pathname={pathname} />

        <nav className="mx-auto hidden items-center rounded-pill bg-white/[0.04] p-1 sm:flex" aria-label="Main">
          {tabs.map((tab) => {
            const active = tab.match(pathname);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={cn(
                  "relative rounded-pill px-4 py-1.5 text-sm transition",
                  active ? "bg-white text-black shadow-[inset_0_-2px_0_0_var(--accent)]" : "text-secondary hover:text-primary",
                )}
              >
                {tab.label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-2 sm:gap-3">
          <SearchMenu />
          <NoticeMenu hasUnread={hasUnread} />
          <Link
            href={user ? profilePath(user.role) : "/login"}
            aria-label="Settings"
            className="grid h-9 w-9 place-items-center rounded-pill text-secondary transition hover:text-primary"
          >
            <Settings size={16} />
          </Link>
          {user ? <UserMenu user={user} /> : null}
        </div>
      </div>
    </header>
  );
}

function MobileNavMenu({ tabs, pathname }: { tabs: TopBarTab[]; pathname: string }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <div className="relative sm:hidden" ref={box}>
      <button
        type="button"
        aria-label={open ? "Close navigation menu" : "Open navigation menu"}
        aria-expanded={open}
        className="grid h-9 w-9 place-items-center rounded-pill border border-card text-secondary hover:text-primary"
        onClick={() => setOpen((value) => !value)}
      >
        {open ? <X size={16} /> : <Menu size={16} />}
      </button>
      {open ? (
        <div className="absolute left-0 top-11 z-40 w-56 rounded-card border border-card bg-card p-2 shadow-2xl">
          {tabs.map((tab) => {
            const active = tab.match(pathname);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                onClick={() => setOpen(false)}
                className={cn(
                  "block rounded-pill px-3 py-2.5 text-sm transition",
                  active
                    ? "bg-white text-black shadow-[inset_0_-2px_0_0_var(--accent)]"
                    : "text-secondary hover:bg-white/5 hover:text-primary",
                )}
              >
                {tab.label}
              </Link>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function SearchMenu() {
  const { accessToken, user } = useAuth();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<Ticket[]>([]);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  useEffect(() => {
    if (!open || !accessToken) return;
    const path = user?.role === "CUSTOMER" ? "/tickets/mine" : "/tickets";
    void api<{ tickets: Ticket[] }>(path, { token: accessToken }).then((r) => setRows(r.tickets));
  }, [open, accessToken, user?.role]);

  const hits = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows.slice(0, 6);
    return rows.filter((t) => `${t.ticketNumber} ${t.subject} ${t.description}`.toLowerCase().includes(q)).slice(0, 8);
  }, [rows, query]);

  return (
    <div className="relative" ref={box}>
      <button
        type="button"
        aria-label="Search"
        className="grid h-9 w-9 place-items-center rounded-pill text-secondary transition hover:text-primary"
        onClick={() => setOpen((v) => !v)}
      >
        <Search size={16} />
      </button>
      {open ? (
        <div className="absolute right-0 top-11 z-40 w-80 rounded-card border border-card bg-card p-3 shadow-2xl">
          <Input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search tickets…" />
          <div className="mt-2 max-h-72 space-y-1 overflow-y-auto">
            {hits.map((ticket) => (
              <Link
                key={ticket.id}
                href={user ? ticketDetailPath(user.role, ticket.id) : "/login"}
                onClick={() => setOpen(false)}
                className="block rounded-xl px-3 py-2 hover:bg-white/5"
              >
                <p className="text-[11px] text-secondary">{ticket.ticketNumber}</p>
                <p className="truncate text-sm text-primary">{ticket.subject}</p>
              </Link>
            ))}
            {hits.length === 0 ? <p className="px-3 py-4 text-sm text-secondary">No tickets match.</p> : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function NoticeMenu({ hasUnread }: { hasUnread: boolean }) {
  const { user } = useAuth();
  const { notices, markAllRead } = useNotices();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    markAllRead();
    const onDoc = (e: MouseEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open, markAllRead]);

  return (
    <div className="relative" ref={box}>
      <button
        type="button"
        aria-label="Notifications"
        className="relative grid h-9 w-9 place-items-center rounded-pill text-secondary transition hover:text-primary"
        onClick={() => setOpen((v) => !v)}
      >
        <Bell size={16} />
        {hasUnread ? <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-danger ring-2 ring-page" /> : null}
      </button>
      {open ? (
        <div className="absolute right-0 top-11 z-40 w-80 rounded-card border border-card bg-card p-3 shadow-2xl">
          <p className="px-2 pb-2 text-xs uppercase tracking-[0.14em] text-secondary">Alerts</p>
          <div className="max-h-80 space-y-1 overflow-y-auto">
            {notices.length === 0 ? (
              <p className="px-2 py-6 text-sm text-secondary">No status or booking alerts yet.</p>
            ) : null}
            {notices.map((notice) => (
              <Link
                key={notice.id}
                href={
                  user
                    ? notice.ticketId
                      ? ticketDetailPath(user.role, notice.ticketId)
                      : ticketsPath(user.role)
                    : "/login"
                }
                onClick={() => setOpen(false)}
                className="block rounded-xl px-3 py-2 hover:bg-white/5"
              >
                <p className="text-sm text-primary">{notice.title}</p>
                <p className="truncate text-xs text-secondary">{notice.body}</p>
              </Link>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function UserMenu({ user }: { user: { name: string; email: string; avatarHue: number } }) {
  const { logout } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const onLogout = async () => {
    setOpen(false);
    await logout();
    router.replace("/login");
  };

  return (
    <div className="relative" ref={box}>
      <button
        type="button"
        aria-label="Account menu"
        aria-expanded={open}
        className="flex items-center gap-2 rounded-pill py-1 pl-1 pr-2 transition hover:bg-white/5"
        onClick={() => setOpen((v) => !v)}
      >
        <Avatar name={user.name} hue={user.avatarHue} size="sm" />
        <div className="hidden min-w-0 text-left leading-tight sm:block">
          <p className="truncate text-sm font-medium text-primary">{user.name}</p>
          <p className="truncate text-[11px] text-secondary">{user.email}</p>
        </div>
        <ChevronDown size={14} className={cn("hidden text-secondary transition sm:block", open && "rotate-180")} />
      </button>
      {open ? (
        <div className="absolute right-0 top-11 z-40 w-56 rounded-card border border-card bg-card p-2 shadow-2xl">
          <div className="border-b border-card px-3 py-2.5 sm:hidden">
            <p className="truncate text-sm font-medium text-primary">{user.name}</p>
            <p className="truncate text-xs text-secondary">{user.email}</p>
          </div>
          <button
            type="button"
            onClick={() => void onLogout()}
            className="flex w-full items-center gap-2 rounded-pill px-3 py-2.5 text-sm text-secondary transition hover:bg-white/5 hover:text-primary"
          >
            <LogOut size={15} />
            Log out
          </button>
        </div>
      ) : null}
    </div>
  );
}
