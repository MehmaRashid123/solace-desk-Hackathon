import { beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";
import { cacheDel, cacheGet, cacheSet } from "../src/lib/redis.js";
import { enqueueJob, getQueueMetrics } from "../src/services/queue.js";

const app = createApp();

async function login(email: string) {
  const res = await request(app).post("/api/auth/login").send({ email, password: "password123" });
  return {
    token: res.body?.data?.accessToken as string | undefined,
    userId: res.body?.data?.user?.id as string | undefined,
  };
}

describe("Advanced Bonus Features: Redis Cache, Queue, and GraphQL", () => {
  let customerToken = "";
  let agentToken = "";

  beforeAll(async () => {
    const customer = await login("ava@lumen.dev");
    const agent = await login("maya@lumen.dev");
    customerToken = customer.token ?? "";
    agentToken = agent.token ?? "";
  });

  describe("1. Redis & Resilient Cache Layer", () => {
    it("stores, retrieves, and deletes cached data with TTL", async () => {
      const testKey = "test:user:123";
      const data = { name: "Ava Patel", role: "CUSTOMER", score: 98 };

      await cacheSet(testKey, data, 10);
      const retrieved = await cacheGet<{ name: string; score: number }>(testKey);

      expect(retrieved).not.toBeNull();
      expect(retrieved?.name).toBe("Ava Patel");
      expect(retrieved?.score).toBe(98);

      await cacheDel(testKey);
      const afterDel = await cacheGet(testKey);
      expect(afterDel).toBeNull();
    });

    it("supports pattern-based cache invalidation (wildcard)", async () => {
      await cacheSet("stats:customer:1", { count: 5 }, 10);
      await cacheSet("stats:agent:2", { count: 8 }, 10);
      await cacheSet("other:key", { keep: true }, 10);

      await cacheDel("stats:*");

      expect(await cacheGet("stats:customer:1")).toBeNull();
      expect(await cacheGet("stats:agent:2")).toBeNull();
      expect(await cacheGet("other:key")).not.toBeNull();
    });
  });

  describe("2. Background Job Queue", () => {
    it("enqueues jobs and updates metrics", async () => {
      const initialMetrics = getQueueMetrics();
      expect(initialMetrics).toBeDefined();
      expect(typeof initialMetrics.pending).toBe("number");

      const jobId = enqueueJob("EMAIL_NOTIFICATION", {
        to: "test@example.com",
        subject: "Queue Test Email",
        text: "Testing background worker dispatch",
        html: "<p>Testing</p>",
      });

      expect(jobId).toMatch(/^job_/);

      // Allow event loop to process job
      await new Promise((resolve) => setTimeout(resolve, 50));

      const updatedMetrics = getQueueMetrics();
      expect(updatedMetrics.processed).toBeGreaterThanOrEqual(initialMetrics.processed);
    });
  });

  describe("3. GraphQL API Endpoint (/graphql)", () => {
    it("queries public data and queue status via GraphQL", async () => {
      const res = await request(app)
        .post("/graphql")
        .send({
          query: `
            query {
              workers {
                id
                name
                role
              }
              queueStatus {
                pending
                processed
                isRedisActive
              }
            }
          `,
        });

      expect(res.status).toBe(200);
      expect(res.body.data.workers).toEqual(expect.any(Array));
      expect(res.body.data.workers.length).toBeGreaterThan(0);
      expect(res.body.data.queueStatus).toHaveProperty("pending");
      expect(res.body.data.queueStatus).toHaveProperty("processed");
    });

    it("queries authenticated user profile and tickets via GraphQL", async () => {
      const res = await request(app)
        .post("/graphql")
        .set("Authorization", `Bearer ${customerToken}`)
        .send({
          query: `
            query {
              me {
                name
                email
                role
              }
              tickets {
                id
                ticketNumber
                subject
                status
              }
            }
          `,
        });

      expect(res.status).toBe(200);
      expect(res.body.data.me.email).toBe("ava@lumen.dev");
      expect(res.body.data.me.role).toBe("CUSTOMER");
      expect(res.body.data.tickets).toEqual(expect.any(Array));
    });

    it("queries dashboard stats via GraphQL", async () => {
      const res = await request(app)
        .post("/graphql")
        .set("Authorization", `Bearer ${agentToken}`)
        .send({
          query: `
            query {
              stats {
                total
                open
                inProgress
                resolved
                high
                categoryBreakdown {
                  category
                  count
                }
              }
            }
          `,
        });

      expect(res.status).toBe(200);
      expect(res.body.data.stats).toHaveProperty("total");
      expect(res.body.data.stats).toHaveProperty("categoryBreakdown");
      expect(Array.isArray(res.body.data.stats.categoryBreakdown)).toBe(true);
    });

    it("executes GraphQL mutations: createTicket and addMessage", async () => {
      // 1. Create Ticket via GraphQL
      const createRes = await request(app)
        .post("/graphql")
        .set("Authorization", `Bearer ${customerToken}`)
        .send({
          query: `
            mutation CreateTestTicket($subject: String!, $description: String!) {
              createTicket(subject: $subject, description: $description) {
                id
                ticketNumber
                subject
                status
              }
            }
          `,
          variables: {
            subject: "GraphQL Mutation Ticket Test",
            description: "Creating a ticket through GraphQL endpoint.",
          },
        });

      expect(createRes.status).toBe(200);
      const ticket = createRes.body.data.createTicket;
      expect(ticket.ticketNumber).toMatch(/^TCK-/);
      expect(ticket.subject).toBe("GraphQL Mutation Ticket Test");

      // 2. Add Message via GraphQL
      const msgRes = await request(app)
        .post("/graphql")
        .set("Authorization", `Bearer ${customerToken}`)
        .send({
          query: `
            mutation AddTestMessage($ticketId: ID!, $body: String!) {
              addMessage(ticketId: $ticketId, body: $body) {
                id
                ticketId
                body
                senderRole
              }
            }
          `,
          variables: {
            ticketId: ticket.id,
            body: "Hello from GraphQL message mutation!",
          },
        });

      expect(msgRes.status).toBe(200);
      expect(msgRes.body.data.addMessage.body).toBe("Hello from GraphQL message mutation!");
      expect(msgRes.body.data.addMessage.ticketId).toBe(ticket.id);
    });
  });
});
