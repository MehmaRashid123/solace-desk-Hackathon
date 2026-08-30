"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import { CATEGORIES } from "@/lib/format";
import type { Ticket } from "@/lib/types";
import { LoaderCircle } from "lucide-react";
import { AiTriageSuggestion, type TriageSuggestion } from "@/components/AiTriageSuggestion";
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
  const [previewLoading, setPreviewLoading] = useState(false);
  const [suggestion, setSuggestion] = useState<TriageSuggestion | null>(null);
  const previewTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (user && user.role !== "CUSTOMER" && user.role !== "ADMIN") router.replace(ticketsPath(user.role));
  }, [user, router]);

  useEffect(() => {
    if (!accessToken) return;
    const ready = subject.trim().length >= 4 && description.trim().length >= 8;
    if (!ready) {
      setSuggestion(null);
      setPreviewLoading(false);
      return;
    }

    if (previewTimer.current) clearTimeout(previewTimer.current);
    setPreviewLoading(true);
    previewTimer.current = setTimeout(() => {
      void api<{ suggestion: TriageSuggestion }>("/tickets/triage-preview", {
        method: "POST",
        token: accessToken,
        body: { subject: subject.trim(), description: description.trim() },
      })
        .then((r) => setSuggestion(r.suggestion))
        .catch(() => setSuggestion({ ok: false }))
        .finally(() => setPreviewLoading(false));
    }, 900);

    return () => {
      if (previewTimer.current) clearTimeout(previewTimer.current);
    };
  }, [accessToken, subject, description]);

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
      if (ticket.aiPriority) {
        toast(`AI suggests ${ticket.aiPriority} priority for this ticket`, "ok");
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
      <PageToolbar title="New ticket" subtitle="Describe your issue — AI suggests priority as you type." />
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

          <AiTriageSuggestion suggestion={suggestion} loading={previewLoading} />

          {error ? <p className="text-sm text-rose-300">{error}</p> : null}
          <Button variant="pill" className="w-full" disabled={busy}>
            {busy ? (
              <span className="inline-flex items-center justify-center gap-2">
                <LoaderCircle size={16} className="animate-spin" />
                Creating ticket…
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
