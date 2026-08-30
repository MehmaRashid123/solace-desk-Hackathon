"use client";

import { useCallback, useEffect, useState } from "react";
import { Star } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useSocket } from "@/context/SocketContext";
import { useToast } from "@/context/ToastContext";
import { Avatar, Button, Field, Glass, Input, Select, Skeleton } from "@/components/ui";
import { PageToolbar } from "@/components/AppShell";
import { api } from "@/lib/api";
import { CATEGORIES, relativeTime } from "@/lib/format";
import type { WorkerProfile, WorkerReview } from "@/lib/types";

const AVATAR_HUES = [200, 260, 320, 40, 80, 140, 180, 220];

function ReviewList({ reviews }: { reviews: WorkerReview[] }) {
  if (reviews.length === 0) {
    return (
      <Glass className="p-6 text-sm text-muted">
        No customer reviews yet. Reviews appear here after customers rate completed tickets.
      </Glass>
    );
  }

  return (
    <div className="grid gap-3">
      {reviews.map((review, i) => (
        <Glass key={i} className="p-4">
          <div className="flex items-center gap-1 text-amber-400">
            {Array.from({ length: review.stars }).map((_, j) => (
              <Star key={j} size={12} className="fill-current" />
            ))}
            <span className="ml-2 text-xs text-secondary">{review.customerName}</span>
          </div>
          {review.comment ? <p className="mt-2 text-sm text-muted">{review.comment}</p> : null}
          <p className="mt-2 text-[11px] text-secondary">{relativeTime(review.createdAt)}</p>
        </Glass>
      ))}
    </div>
  );
}

function ProfileSettingsForm() {
  const { user, accessToken, updateProfile } = useAuth();
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [avatarHue, setAvatarHue] = useState(200);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [workerCategory, setWorkerCategory] = useState("");
  const [isAvailable, setIsAvailable] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const isWorker = user?.role === "AGENT";

  const loadWorkerSettings = useCallback(() => {
    if (!accessToken || !isWorker) return;
    void api<{ worker: WorkerProfile }>("/workers/me", { token: accessToken })
      .then((r) => {
        if (!r?.worker?.id) return;
        setWorkerCategory(r.worker.category ?? "");
        setIsAvailable(r.worker.isAvailable);
      })
      .catch(() => undefined);
  }, [accessToken, isWorker]);

  useEffect(() => {
    if (!user) return;
    setName(user.name);
    setAvatarHue(user.avatarHue);
  }, [user]);

  useEffect(() => {
    loadWorkerSettings();
  }, [loadWorkerSettings]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!accessToken || !user) return;
    setBusy(true);
    setError("");
    try {
      await updateProfile({
        name: name.trim(),
        avatarHue,
        ...(newPassword
          ? { currentPassword, newPassword }
          : {}),
      });

      if (isWorker) {
        await api("/workers/me", {
          method: "PATCH",
          token: accessToken,
          body: {
            category: workerCategory || null,
            isAvailable,
          },
        });
        loadWorkerSettings();
      }

      setCurrentPassword("");
      setNewPassword("");
      toast("Profile updated", "ok");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not save profile";
      setError(message);
      toast(message);
    } finally {
      setBusy(false);
    }
  }

  if (!user) return null;

  return (
    <Glass className="mt-4 p-6">
      <h2 className="text-sm font-medium text-primary">Settings</h2>
      <p className="mt-1 text-xs text-muted">Update your display name, avatar, and password.</p>
      <form className="mt-4 space-y-4" onSubmit={(e) => void save(e)}>
        <Field label="Display name">
          <Input value={name} onChange={(e) => setName(e.target.value)} minLength={2} maxLength={80} required />
        </Field>

        <Field label="Avatar color">
          <div className="flex flex-wrap gap-2">
            {AVATAR_HUES.map((hue) => (
              <button
                key={hue}
                type="button"
                aria-label={`Avatar hue ${hue}`}
                className={`h-9 w-9 rounded-full ring-2 transition ${avatarHue === hue ? "ring-white" : "ring-transparent hover:ring-white/40"}`}
                style={{ background: `linear-gradient(145deg, hsl(${hue} 70% 48%), hsl(${(hue + 40) % 360} 60% 32%))` }}
                onClick={() => setAvatarHue(hue)}
              />
            ))}
          </div>
        </Field>

        {isWorker ? (
          <>
            <Field label="Specialty category">
              <Select value={workerCategory} onChange={(e) => setWorkerCategory(e.target.value)}>
                <option value="">General support</option>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
            </Field>
            <label className="flex cursor-pointer items-center gap-3 text-sm text-muted">
              <input
                type="checkbox"
                checked={isAvailable}
                onChange={(e) => setIsAvailable(e.target.checked)}
                className="h-4 w-4 rounded border-white/20 bg-white/5 accent-accent"
              />
              Available for new customer bookings
            </label>
          </>
        ) : null}

        <div className="border-t border-white/10 pt-4">
          <p className="text-xs uppercase tracking-wider text-secondary">Change password</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <Field label="Current password">
              <Input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                autoComplete="current-password"
                placeholder="Leave blank to keep password"
              />
            </Field>
            <Field label="New password">
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
                minLength={8}
                placeholder="Min. 8 characters"
              />
            </Field>
          </div>
        </div>

        <p className="text-xs text-secondary">Email: {user.email} (cannot be changed here)</p>
        {error ? <p className="text-sm text-rose-300">{error}</p> : null}
        <Button variant="pill" disabled={busy}>
          {busy ? "Saving…" : "Save changes"}
        </Button>
      </form>
    </Glass>
  );
}

function WorkerProfileSection() {
  const { user, accessToken } = useAuth();
  const { socket } = useSocket();
  const [worker, setWorker] = useState<WorkerProfile | null>(null);
  const [reviews, setReviews] = useState<WorkerReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    (opts?: { silent?: boolean }) => {
      if (!accessToken) return;
      if (!opts?.silent) {
        setLoading(true);
        setError(null);
      }
      void api<{ worker: WorkerProfile; reviews: WorkerReview[] }>("/workers/me", { token: accessToken })
        .then((r) => {
          if (!r?.worker?.id) {
            throw new Error("Worker profile not found");
          }
          setWorker(r.worker);
          setReviews(Array.isArray(r.reviews) ? r.reviews : []);
        })
        .catch((err) => setError(err instanceof Error ? err.message : "Could not load reviews"))
        .finally(() => {
          if (!opts?.silent) setLoading(false);
        });
    },
    [accessToken],
  );

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!socket || !user || user.role !== "AGENT") return;
    const onNewReview = (payload: { workerId: string; review: WorkerReview }) => {
      if (payload.workerId !== user.id) return;
      setReviews((prev) => {
        const exists = prev.some(
          (r) => r.createdAt === payload.review.createdAt && r.customerName === payload.review.customerName,
        );
        if (exists) return prev;
        return [payload.review, ...prev];
      });
      void load({ silent: true });
    };
    socket.on("worker:newReview", onNewReview);
    return () => {
      socket.off("worker:newReview", onNewReview);
    };
  }, [socket, user, load]);

  if (loading) {
    return (
      <div className="mt-6 space-y-3">
        <Skeleton className="h-20" />
        <Skeleton className="h-24" />
      </div>
    );
  }

  if (error) {
    return (
      <Glass className="mt-6 p-4 text-sm text-rose-300">
        {error}{" "}
        <button type="button" className="underline" onClick={() => load()}>
          Retry
        </button>
      </Glass>
    );
  }

  if (!worker) return null;

  return (
    <div className="mt-6 space-y-4">
      <Glass className="p-5">
        <p className="text-[11px] uppercase tracking-wider text-secondary">Your rating</p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <div className="flex gap-0.5 text-amber-400">
            {[1, 2, 3, 4, 5].map((n) => (
              <Star
                key={n}
                size={16}
                className={n <= Math.round(worker.avgRating) ? "fill-current" : "text-white/20"}
              />
            ))}
          </div>
          <span className="text-sm text-primary">
            {worker.avgRating > 0 ? worker.avgRating.toFixed(1) : "No rating yet"} · {worker.ratingCount} review
            {worker.ratingCount === 1 ? "" : "s"}
          </span>
        </div>
        <p className="mt-3 text-xs text-muted">
          {worker.completedTickets} completed ticket{worker.completedTickets === 1 ? "" : "s"} · {worker.replyCount}{" "}
          replies sent
        </p>
      </Glass>

      <div>
        <h2 className="text-sm font-medium text-primary">Customer reviews</h2>
        <div className="mt-3">
          <ReviewList reviews={reviews} />
        </div>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const { user } = useAuth();
  if (!user) return null;

  const isWorker = user.role === "AGENT";

  return (
    <div className="mx-auto max-w-xl">
      <PageToolbar
        title="Account"
        subtitle={isWorker ? "Update your profile, availability, and see customer feedback." : "Manage your account settings."}
      />
      <Glass className="flex items-center gap-4 p-6">
        <Avatar name={user.name} hue={user.avatarHue} size="lg" />
        <div>
          <p className="font-medium">{user.name}</p>
          <p className="text-sm text-white/45">{user.email}</p>
          <p className="mt-1 text-[11px] uppercase tracking-wider text-white/35">{isWorker ? "Worker" : user.role}</p>
        </div>
      </Glass>

      <ProfileSettingsForm />

      {isWorker ? <WorkerProfileSection /> : null}
    </div>
  );
}
