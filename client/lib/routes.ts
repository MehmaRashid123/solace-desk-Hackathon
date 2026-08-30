import type { Role } from "@/lib/types";

export function dashboardPath(role: Role) {
  if (role === "CUSTOMER") return "/customer/dashboard";
  if (role === "ADMIN") return "/admin/dashboard";
  return "/worker/dashboard";
}

export function ticketsPath(role: Role) {
  if (role === "CUSTOMER") return "/customer/tickets";
  return "/worker/tickets";
}

export function ticketDetailPath(role: Role, id: string) {
  return `${ticketsPath(role)}/${id}`;
}

export function profilePath(role: Role) {
  if (role === "CUSTOMER") return "/customer/profile";
  if (role === "ADMIN") return "/admin/profile";
  return "/worker/profile";
}

export function newTicketPath() {
  return "/customer/tickets/new";
}

export function workerBookingsPath() {
  return "/worker/bookings";
}

export function adminDashboardPath() {
  return "/admin/dashboard";
}

export function adminWorkersPath() {
  return "/admin/workers";
}

export function adminWorkerDetailPath(id: string) {
  return `/admin/workers/${id}`;
}
