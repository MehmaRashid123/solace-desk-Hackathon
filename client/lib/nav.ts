import type { Role } from "@/lib/types";
import type { TopBarTab } from "@/components/TopBar";
import { newTicketPath, workerBookingsPath } from "@/lib/routes";

export type NavItem = TopBarTab & {
  roles: Role[];
};

export const customerNav: TopBarTab[] = [
  {
    href: "/customer/dashboard",
    label: "Dashboard",
    match: (path) => path === "/customer/dashboard",
  },
  {
    href: "/customer/tickets",
    label: "My Tickets",
    match: (path) => path.startsWith("/customer/tickets") && path !== newTicketPath(),
  },
  {
    href: newTicketPath(),
    label: "New Ticket",
    match: (path) => path === newTicketPath(),
  },
  {
    href: "/customer/profile",
    label: "Profile",
    match: (path) => path.startsWith("/customer/profile"),
  },
];

export const workerNav: TopBarTab[] = [
  {
    href: "/worker/dashboard",
    label: "Dashboard",
    match: (path) => path === "/worker/dashboard",
  },
  {
    href: "/worker/tickets",
    label: "Assigned Tickets",
    match: (path) => path.startsWith("/worker/tickets"),
  },
  {
    href: workerBookingsPath(),
    label: "Incoming Bookings",
    match: (path) => path.startsWith(workerBookingsPath()),
  },
  {
    href: "/worker/profile",
    label: "Profile",
    match: (path) => path.startsWith("/worker/profile"),
  },
];

export const adminNav: TopBarTab[] = [
  {
    href: "/admin/dashboard",
    label: "Overview",
    match: (path) => path === "/admin/dashboard",
  },
  {
    href: "/admin/workers",
    label: "Workers",
    match: (path) => path.startsWith("/admin/workers"),
  },
  {
    href: "/admin/profile",
    label: "Profile",
    match: (path) => path.startsWith("/admin/profile"),
  },
];

export function topNavForRole(role: Role): TopBarTab[] {
  if (role === "CUSTOMER") return customerNav;
  if (role === "ADMIN") return adminNav;
  return workerNav;
}

/** @deprecated Use topNavForRole instead */
export const mainNav: NavItem[] = [];
