"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { Button, Field, Glass, Input } from "@/components/ui";
import { useToast } from "@/context/ToastContext";
import { dashboardPath } from "@/lib/routes";
import { cn } from "@/lib/cn";

export default function RegisterPage() {
  const { register } = useAuth();
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"CUSTOMER" | "AGENT">("CUSTOMER");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const created = await register(name, email, password, role);
      router.push(dashboardPath(created.role));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not register";
      setError(message);
      toast(message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-screen place-items-center px-4">
      <Glass className="w-full max-w-md p-8">
        <p className="text-xs uppercase tracking-[0.2em] text-muted">Solace</p>
        <h1 className="mt-2 text-3xl font-semibold">Create account</h1>
        <form className="mt-8 space-y-4" onSubmit={(e) => void onSubmit(e)}>
          <Field label="Name">
            <Input value={name} onChange={(e) => setName(e.target.value)} required minLength={2} />
          </Field>
          <Field label="Email">
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </Field>
          <Field label="Password">
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} />
          </Field>
          <div>
            <p className="mb-2 text-xs uppercase tracking-[0.16em] text-white/40">Role</p>
            <div className="grid grid-cols-2 gap-2">
              {(["CUSTOMER", "AGENT"] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setRole(option)}
                  className={cn(
                    "rounded-full px-4 py-2 text-xs font-medium uppercase tracking-wide ring-1",
                    role === option
                      ? "bg-accent text-white ring-accent"
                      : "bg-white/[0.03] text-muted ring-white/10",
                  )}
                >
                  {option === "CUSTOMER" ? "Customer" : "Agent"}
                </button>
              ))}
            </div>
            <p className="mt-2 text-[11px] text-white/35">Agent signup is open for the demo. Production would be invite-only.</p>
          </div>
          {error ? <p className="text-sm text-rose-300">{error}</p> : null}
          <Button variant="pill" className="w-full" disabled={busy}>
            {busy ? "Creating…" : "Create account"}
          </Button>
        </form>
        <p className="mt-6 text-sm text-white/40">
          Already have a seat?{" "}
          <Link href="/login" className="text-white hover:underline">
            Sign in
          </Link>
        </p>
      </Glass>
    </div>
  );
}
