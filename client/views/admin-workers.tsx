"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { PageToolbar } from "@/components/DashboardLayout";
import { WorkerCard } from "@/components/WorkerCard";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import { adminWorkerDetailPath } from "@/lib/routes";
import type { WorkerProfile } from "@/lib/types";
import { Glass, Skeleton } from "@/components/ui";

export default function AdminWorkersPage() {
  const { accessToken } = useAuth();
  const [workers, setWorkers] = useState<WorkerProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!accessToken) return;
    setLoading(true);
    setError(null);
    void api<{ workers: WorkerProfile[] }>("/admin/workers", { token: accessToken })
      .then((r) => setWorkers(r.workers))
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load workers"))
      .finally(() => setLoading(false));
  }, [accessToken]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading && workers.length === 0) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-20" />
        <div className="grid gap-4 xl:grid-cols-2">
          <Skeleton className="h-56" />
          <Skeleton className="h-56" />
        </div>
      </div>
    );
  }

  if (error && workers.length === 0) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4 text-center">
        <p className="text-secondary">{error}</p>
        <button type="button" onClick={load} className="inline-flex items-center gap-2 text-sm text-accent hover:underline">
          <RefreshCw size={14} />
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageToolbar
        title="Workers"
        subtitle="Open a worker to see their ratings, replies, and assigned tickets."
        onRefresh={load}
      />

      {workers.length === 0 ? (
        <Glass className="p-8 text-center text-sm text-muted">No workers registered yet.</Glass>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {workers.map((worker) => (
            <WorkerCard key={worker.id} worker={worker} href={adminWorkerDetailPath(worker.id)} />
          ))}
        </div>
      )}

      {error && workers.length > 0 ? (
        <p className="text-center text-sm text-danger">
          {error}{" "}
          <button type="button" className="underline" onClick={load}>
            Retry
          </button>
        </p>
      ) : null}
    </div>
  );
}
