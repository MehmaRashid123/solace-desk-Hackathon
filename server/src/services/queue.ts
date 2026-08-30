import { isRedisHealthy, cacheGet, cacheSet } from "../lib/redis.js";
import { sendEmail, type EmailPayload } from "./email.js";
import { runInternalTriage } from "./triage.js";
import { getDashboardStats } from "./stats.js";
import type { Role } from "@prisma/client";

export type JobType = "EMAIL_NOTIFICATION" | "AI_TRIAGE_ASYNC" | "STATS_CACHE_REFRESH";

export type Job<T = any> = {
  id: string;
  type: JobType;
  payload: T;
  createdAt: number;
  attempts: number;
};

const jobQueue: Job[] = [];
let isProcessing = false;
let processedCount = 0;
let failedCount = 0;

export function getQueueMetrics() {
  return {
    pending: jobQueue.length,
    processed: processedCount,
    failed: failedCount,
    isRedisActive: isRedisHealthy(),
  };
}

async function processJob(job: Job): Promise<void> {
  switch (job.type) {
    case "EMAIL_NOTIFICATION": {
      await sendEmail(job.payload as EmailPayload);
      break;
    }
    case "AI_TRIAGE_ASYNC": {
      const { ticketId } = job.payload as { ticketId: string };
      if (ticketId) {
        await runInternalTriage(ticketId);
      }
      break;
    }
    case "STATS_CACHE_REFRESH": {
      const { role, userId } = job.payload as { role: Role; userId: string };
      if (role && userId) {
        await getDashboardStats(role, userId);
      }
      break;
    }
    default:
      console.warn("Unknown job type:", job.type);
  }
}

async function runQueueWorker() {
  if (isProcessing) return;
  isProcessing = true;

  while (jobQueue.length > 0) {
    const job = jobQueue.shift();
    if (!job) break;

    try {
      await processJob(job);
      processedCount++;
    } catch (err) {
      failedCount++;
      console.error(`[Queue Error] Job ${job.id} (${job.type}) failed:`, err instanceof Error ? err.message : err);
      // Retry once if attempts < 2
      if (job.attempts < 2) {
        job.attempts++;
        jobQueue.push(job);
      }
    }
  }

  isProcessing = false;
}

export function enqueueJob<T>(type: JobType, payload: T): string {
  const id = `job_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const job: Job<T> = {
    id,
    type,
    payload,
    createdAt: Date.now(),
    attempts: 0,
  };

  jobQueue.push(job);

  // Trigger worker asynchronously
  setImmediate(() => {
    void runQueueWorker();
  });

  return id;
}
