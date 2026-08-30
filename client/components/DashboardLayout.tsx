"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { BarChart3, CalendarDays, LayoutDashboard, Plus, RefreshCw, Settings, Ticket, Users } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useNotices } from "@/context/NoticeContext";
import { cn } from "@/lib/cn";
import { APP_NAME } from "@/lib/brand";
import { dashboardPath, newTicketPath, profilePath } from "@/lib/routes";
import { topNavForRole } from "@/lib/nav";
import { Button, LogoBadge } from "./ui";
import { TopBar } from "./TopBar";
import { useEffect } from "react";

const icons = {
  Dashboard: LayoutDashboard,
  "My Tickets": Ticket,
  "New Ticket": Plus,
  Profile: Settings,
  "Assigned Tickets": Ticket,
  "Incoming Bookings": CalendarDays,
  Tickets: Ticket,
  Workers: Users,
  Overview: LayoutDashboard,
  Reports: BarChart3,
} as const;

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, ready } = useAuth();
  const { unreadNotifications } = useNotices();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (ready && !user) router.replace("/login");
  }, [ready, user, router]);

  if (!ready || !user) {
    return <div className="grid min-h-screen place-items-center text-muted">Loading {APP_NAME}…</div>;
  }

  const links = topNavForRole(user.role);

  return (
    <div className="min-h-screen bg-page text-primary">
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-sidebar flex-col border-r border-[var(--card-border)] bg-[var(--bg)] md:flex">
        <Link href={dashboardPath(user.role)} className="flex items-center gap-2.5 px-5 py-5">
          <LogoBadge />
          <span className="text-[15px] font-semibold tracking-wide">{APP_NAME}</span>
        </Link>
        <nav className="flex flex-1 flex-col gap-1 px-3">
          {links.map((link) => {
            const active = link.match(pathname);
            const Icon = icons[link.label as keyof typeof icons] ?? LayoutDashboard;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "flex items-center gap-3 rounded-pill px-3 py-2.5 text-sm transition",
                  active ? "bg-white text-black shadow-[inset_0_-2px_0_0_var(--accent)]" : "text-muted hover:bg-white/5 hover:text-white",
                )}
              >
                <Icon size={16} />
                {link.label}
              </Link>
            );
          })}
        </nav>
        <Link href={profilePath(user.role)} className="mx-3 mb-4 flex items-center gap-3 rounded-pill px-3 py-2.5 text-sm text-muted hover:bg-white/5 hover:text-white">
          <Settings size={16} />
          Profile
        </Link>
      </aside>

      <div className="md:pl-[var(--sidebar)]">
        <TopBar tabs={links} hasUnread={unreadNotifications > 0} />
        <main className="px-4 py-6 pb-24 md:px-6 md:pb-10">{children}</main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-[var(--card-border)] bg-[var(--bg)]/95 px-2 py-2 md:hidden">
        <div className="flex gap-1">
          {links.map((link) => {
            const active = link.match(pathname);
            const Icon = icons[link.label as keyof typeof icons] ?? LayoutDashboard;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "flex flex-1 flex-col items-center gap-1 rounded-2xl px-2 py-2 text-[10px]",
                  active ? "bg-white text-black" : "text-muted",
                )}
              >
                <Icon size={16} />
                {link.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

export function PageToolbar({
  title,
  subtitle,
  onRefresh,
  extra,
}: {
  title: string;
  subtitle: string;
  onRefresh?: () => void;
  extra?: React.ReactNode;
}) {
  const { user } = useAuth();
  const pathname = usePathname();
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-[28px] font-semibold tracking-tight text-white">{title}</h1>
        <p className="mt-1 text-sm text-muted">{subtitle}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {extra}
        {user?.role === "CUSTOMER" && pathname !== newTicketPath() ? (
          <Link href={newTicketPath()}>
            <Button>
              <Plus size={15} />
              New ticket
            </Button>
          </Link>
        ) : null}
        {onRefresh ? (
          <button
            type="button"
            aria-label="Refresh"
            onClick={onRefresh}
            className="grid h-10 w-10 place-items-center rounded-pill border border-[var(--card-border)] text-muted hover:bg-white/5 hover:text-white"
          >
            <RefreshCw size={15} />
          </button>
        ) : null}
      </div>
    </div>
  );
}
