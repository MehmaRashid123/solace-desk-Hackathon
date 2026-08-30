"use client";

import Link from "next/link";
import { ArrowRight, Headset, Ticket } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { Button, Glass, LogoBadge } from "@/components/ui";
import { APP_NAME, APP_TAGLINE } from "@/lib/brand";
import { dashboardPath } from "@/lib/routes";

export default function LandingPage() {
  const { user } = useAuth();

  return (
    <div className="relative mx-auto min-h-screen max-w-6xl px-5 py-8">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <LogoBadge size={36} />
          <span className="text-lg font-semibold tracking-tight">{APP_NAME}</span>
        </div>
        <div className="flex gap-2">
          {user ? (
            <Link href={dashboardPath(user.role)}>
              <Button>Open desk</Button>
            </Link>
          ) : (
            <>
              <Link href="/login">
                <Button variant="ghost">Sign in</Button>
              </Link>
              <Link href="/register">
                <Button variant="pill">Create account</Button>
              </Link>
            </>
          )}
        </div>
      </header>

      <section className="mt-16 max-w-3xl">
        <p className="mb-4 text-xs uppercase tracking-[0.2em] text-muted">Support desk</p>
        <h1 className="text-5xl font-semibold leading-[1.05] tracking-tight text-white md:text-6xl">
          {APP_NAME}.
          <span className="block text-muted">{APP_TAGLINE}</span>
        </h1>
        <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted">
          Customers open a ticket and follow it. Agents claim, triage, and close it — live, with server-side AI.
        </p>
      </section>

      <section className="mt-12 grid gap-4 md:grid-cols-2">
        <Glass className="p-6">
          <Ticket className="mb-4 text-accent" size={22} />
          <h2 className="text-xl font-semibold">For customers</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            Open a ticket, see if an agent has it, and keep talking in the thread until it is resolved.
          </p>
          <p className="mt-4 text-xs text-muted">Demo · ava@lumen.dev · password123</p>
          <Link href="/login" className="mt-6 inline-flex">
            <Button>
              Customer sign in <ArrowRight size={16} />
            </Button>
          </Link>
        </Glass>
        <Glass className="p-6">
          <Headset className="mb-4 text-accent" size={22} />
          <h2 className="text-xl font-semibold">For workers</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            Dashboard, live queue, claim, AI review, and resolve — only on tickets assigned to you.
          </p>
          <p className="mt-4 text-xs text-muted">Demo · maya@lumen.dev · password123</p>
          <Link href="/login" className="mt-6 inline-flex">
            <Button variant="ghost">
              Agent sign in <ArrowRight size={16} />
            </Button>
          </Link>
        </Glass>
      </section>
    </div>
  );
}
