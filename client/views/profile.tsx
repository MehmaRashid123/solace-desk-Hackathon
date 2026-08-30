"use client";

import { useAuth } from "@/context/AuthContext";
import { Avatar, Glass } from "@/components/ui";
import { PageToolbar } from "@/components/AppShell";

export default function SettingsPage() {
  const { user } = useAuth();
  if (!user) return null;

  return (
    <div className="mx-auto max-w-xl">
      <PageToolbar title="Account" subtitle="This is the seat you are signed in as." />
      <Glass className="flex items-center gap-4 p-6">
        <Avatar name={user.name} hue={user.avatarHue} size="lg" />
        <div>
          <p className="font-medium">{user.name}</p>
          <p className="text-sm text-white/45">{user.email}</p>
          <p className="mt-1 text-[11px] uppercase tracking-wider text-white/35">{user.role}</p>
        </div>
      </Glass>
      <p className="mt-4 text-sm text-white/40">
        {user.role === "CUSTOMER"
          ? "This account can open tickets, choose a worker, and reply until resolved."
          : user.role === "ADMIN"
            ? "This seat sees all customer queries and worker activity across the platform."
            : "This seat can accept bookings, change status, and save AI reviews."}
      </p>
    </div>
  );
}
