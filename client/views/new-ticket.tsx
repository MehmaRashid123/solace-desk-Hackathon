"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import { CATEGORIES } from "@/lib/format";
import type { Ticket } from "@/lib/types";
import { LoaderCircle } from "lucide-react";
import { Button, Field, Glass, Input, Select, Textarea } from "@/components/ui";
import { PageToolbar } from "@/components/AppShell";
import { ticketDetailPath, ticketsPath } from "@/lib/routes";
import { useToast } from "@/context/ToastContext";

export default function NewTicketPage() {
  const { user, accessToken } = useAuth();
  const router = useRouter();
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (user && user.role !== "CUSTOMER" && user.role !== "ADMIN") router.replace(ticketsPath(user.role));
  }, [user, router]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!accessToken) return;
    if (subject.trim().length < 4) {
      setError("Subject needs at least 4 characters");
      return;
    }
    if (description.trim().length < 8) {
      setError("Description needs at least 8 characters");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const { ticket, duplicates } = await api<{ ticket: Ticket; duplicates?: Ticket[] }>("/tickets", {
        method: "POST",
        token: accessToken,
        body: {
          subject,
          description,
          ...(category ? { category } : {}),
        },
      });
      if (duplicates?.length) {
        toast(`${duplicates.length} similar open ticket${duplicates.length === 1 ? "" : "s"} found`, "ok");
      }
      router.push(ticketDetailPath(user!.role, ticket.id));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not create ticket";
      setError(message);
      toast(message);
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <PageToolbar title="New ticket" subtitle="Describe your issue — you'll pick a worker on the next step." />
      <Glass className="p-6">
        <form className="space-y-4" onSubmit={(e) => void submit(e)}>
          <Field label="Subject">
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} minLength={4} required placeholder="Short summary of the issue" />
          </Field>
          <Field label="Description">
            <Textarea rows={7} value={description} onChange={(e) => setDescription(e.target.value)} minLength={8} required placeholder="What happened, and what do you need?" />
          </Field>
          <Field label="Category (optional)">
            <Select value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="">No category</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </Field>
          <p className="text-xs text-white/35">Category is optional. Priority starts as Medium until an agent reviews it.</p>
          {error ? <p className="text-sm text-rose-300">{error}</p> : null}
          <Button variant="pill" className="w-full" disabled={busy}>
            {busy ? (
              <span className="inline-flex items-center justify-center gap-2">
                <LoaderCircle size={16} className="animate-spin" />
                Analyzing ticket...
              </span>
            ) : (
              "Send ticket"
            )}
          </Button>
        </form>
      </Glass>
    </div>
  );
}
