"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { Button, Field, Glass, Input, LogoBadge } from "@/components/ui";
import { APP_NAME } from "@/lib/brand";
import { dashboardPath } from "@/lib/routes";
import { useToast } from "@/context/ToastContext";

const customers = [
  { label: "Ava · customer", email: "ava@lumen.dev" },
  { label: "Noah · customer", email: "noah@lumen.dev" },
];

const workers = [
  { label: "Maya · agent", email: "maya@lumen.dev" },
  { label: "Leo · agent", email: "leo@lumen.dev" },
];

const admins = [{ label: "Admin", email: "admin@lumen.dev" }];

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("ava@lumen.dev");
  const [password, setPassword] = useState("password123");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.includes("@")) {
      setError("Enter a valid email");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const loggedIn = await login(email, password);
      router.push(dashboardPath(loggedIn.role));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Login failed";
      setError(message);
      toast(message);
    } finally {
      setBusy(false);
    }
  }

  function fill(nextEmail: string) {
    setEmail(nextEmail);
    setPassword("password123");
  }

  return (
    <div className="grid min-h-screen place-items-center px-4 py-10">
      <div className="grid w-full max-w-4xl gap-6 lg:grid-cols-[1fr_1.1fr]">
        <div className="hidden flex-col justify-center lg:flex">
          <Link href="/" className="flex items-center gap-2.5">
            <LogoBadge size={36} />
            <span className="text-lg font-semibold">{APP_NAME}</span>
          </Link>
          <h1 className="mt-10 text-4xl font-semibold leading-tight">
            Customer desk
            <span className="block text-white/40">and agent workbench.</span>
          </h1>
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-white/45">
            Customers open tickets and follow the thread. Agents claim, triage, and resolve — live.
          </p>
        </div>
        <Glass className="w-full p-8">
          <p className="text-xs uppercase tracking-[0.2em] text-white/35">Sign in</p>
          <h2 className="mt-2 text-3xl font-semibold">Welcome back</h2>
          <form className="mt-8 space-y-4" onSubmit={(e) => void onSubmit(e)}>
            <Field label="Email">
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="you@nexora.dev" autoComplete="email" />
            </Field>
            <Field label="Password">
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} placeholder="At least 8 characters" autoComplete="current-password" />
            </Field>
            {error ? <p className="text-sm text-rose-300">{error}</p> : null}
            <Button variant="pill" className="w-full" disabled={busy}>
              {busy ? "Signing in…" : "Sign in"}
            </Button>
          </form>
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <div>
              <p className="mb-2 text-[11px] uppercase tracking-[0.14em] text-white/35">Customers</p>
              <div className="flex flex-wrap gap-2">
                {customers.map((seat) => (
                  <button key={seat.email} type="button" className="rounded-full border border-white/10 px-3 py-1 text-xs text-white/60 hover:bg-white/5" onClick={() => fill(seat.email)}>
                    {seat.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-2 text-[11px] uppercase tracking-[0.14em] text-white/35">Workers</p>
              <div className="flex flex-wrap gap-2">
                {workers.map((seat) => (
                  <button key={seat.email} type="button" className="rounded-full border border-white/10 px-3 py-1 text-xs text-white/60 hover:bg-white/5" onClick={() => fill(seat.email)}>
                    {seat.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-2 text-[11px] uppercase tracking-[0.14em] text-white/35">Admin</p>
              <div className="flex flex-wrap gap-2">
                {admins.map((seat) => (
                  <button key={seat.email} type="button" className="rounded-full border border-white/10 px-3 py-1 text-xs text-white/60 hover:bg-white/5" onClick={() => fill(seat.email)}>
                    {seat.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <p className="mt-6 text-sm text-white/40">
            New here?{" "}
            <Link href="/register" className="text-white hover:underline">
              Create an account
            </Link>
          </p>
        </Glass>
      </div>
    </div>
  );
}
