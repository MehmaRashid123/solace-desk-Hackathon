import { Redis } from "ioredis";
import { config } from "../config.js";

type MemoryEntry = { value: string; expiresAt: number | null };
const memoryStore = new Map<string, MemoryEntry>();

let redisClient: Redis | null = null;
let redisConnected = false;

function initRedis() {
  if (!config.redisUrl) return;
  try {
    redisClient = new Redis(config.redisUrl, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      retryStrategy(times) {
        if (times > 3) return null; // stop reconnecting after 3 attempts
        return Math.min(times * 100, 1000);
      },
    });

    redisClient.on("connect", () => {
      redisConnected = true;
      console.log("⚡ [Redis] Connected successfully to", config.redisUrl);
    });

    redisClient.on("error", (err) => {
      redisConnected = false;
      // Log once without spamming
      if (config.nodeEnv !== "test") {
        console.warn("⚠️ [Redis] Connection error, using in-memory cache fallback:", err.message);
      }
    });

    redisClient.on("close", () => {
      redisConnected = false;
    });

    void redisClient.connect().catch(() => {
      redisConnected = false;
    });
  } catch (err) {
    redisConnected = false;
  }
}

// Initialize on load
initRedis();

export function setTestRedisClient(client: Redis | null) {
  redisClient = client;
  redisConnected = Boolean(client);
}

export function isRedisHealthy(): boolean {
  return redisConnected && Boolean(redisClient);
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  try {
    if (isRedisHealthy() && redisClient) {
      const raw = await redisClient.get(key);
      if (!raw) return null;
      return JSON.parse(raw) as T;
    }
  } catch (err) {
    // fallback on error
  }

  // In-Memory Fallback
  const entry = memoryStore.get(key);
  if (!entry) return null;
  if (entry.expiresAt && Date.now() > entry.expiresAt) {
    memoryStore.delete(key);
    return null;
  }
  return JSON.parse(entry.value) as T;
}

export async function cacheSet<T>(key: string, value: T, ttlSeconds = 60): Promise<void> {
  const serialized = JSON.stringify(value);
  try {
    if (isRedisHealthy() && redisClient) {
      await redisClient.set(key, serialized, "EX", ttlSeconds);
      return;
    }
  } catch (err) {
    // fallback on error
  }

  // In-Memory Fallback
  memoryStore.set(key, {
    value: serialized,
    expiresAt: ttlSeconds > 0 ? Date.now() + ttlSeconds * 1000 : null,
  });
}

export async function cacheDel(patternOrKey: string): Promise<void> {
  try {
    if (isRedisHealthy() && redisClient) {
      if (patternOrKey.includes("*")) {
        const keys = await redisClient.keys(patternOrKey);
        if (keys.length > 0) {
          await redisClient.del(...keys);
        }
      } else {
        await redisClient.del(patternOrKey);
      }
    }
  } catch (err) {
    // fallback on error
  }

  // In-Memory Fallback
  if (patternOrKey.includes("*")) {
    const prefix = patternOrKey.replace("*", "");
    for (const key of memoryStore.keys()) {
      if (key.startsWith(prefix)) {
        memoryStore.delete(key);
      }
    }
  } else {
    memoryStore.delete(patternOrKey);
  }
}

export async function cacheClear(): Promise<void> {
  try {
    if (isRedisHealthy() && redisClient) {
      await redisClient.flushdb();
    }
  } catch (err) {
    // fallback on error
  }
  memoryStore.clear();
}
