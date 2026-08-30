import { beforeAll, describe, expect, it } from "vitest";

import request from "supertest";

import { createApp } from "../src/app.js";



const app = createApp();



async function login(email: string) {

  const res = await request(app).post("/api/auth/login").send({ email, password: "password123" });

  return {

    status: res.status,

    body: res.body as { success: boolean; data?: { accessToken: string; user?: { id: string } }; error: string | null },

    token: res.body?.data?.accessToken as string | undefined,

    userId: res.body?.data?.user?.id as string | undefined,

    cookie: res.headers["set-cookie"],

  };

}



describe("Lumen API", () => {

  let ava = "";

  let maya = "";

  let mayaId = "";

  let noah = "";



  beforeAll(async () => {

    const avaSession = await login("ava@lumen.dev");

    const mayaSession = await login("maya@lumen.dev");

    const noahSession = await login("noah@lumen.dev");

    ava = avaSession.token ?? "";

    maya = mayaSession.token ?? "";

    mayaId = mayaSession.userId ?? "";

    noah = noahSession.token ?? "";

  });



  it("health uses the success envelope", async () => {

    const res = await request(app).get("/health");

    expect(res.status).toBe(200);

    expect(res.body.success).toBe(true);

    expect(res.body.data.ok).toBe(true);

  });



  it("rejects a bad password with 401", async () => {

    const res = await request(app).post("/api/auth/login").send({ email: "ava@lumen.dev", password: "wrongpass" });

    expect(res.status).toBe(401);

    expect(res.body.success).toBe(false);

    expect(res.body.error).toBe("Invalid email or password");

  });



  it("issues a JWT and httpOnly refresh cookie", async () => {

    const session = await login("ava@lumen.dev");

    expect(session.status).toBe(200);

    expect(session.token).toBeTruthy();

    expect(String(session.cookie)).toMatch(/lumen_refresh=/);

    expect(String(session.cookie)).toMatch(/HttpOnly/i);

  });



  it("returns 401 without a token", async () => {

    const res = await request(app).get("/api/tickets/mine");

    expect(res.status).toBe(401);

    expect(res.body.success).toBe(false);

  });



  it("returns scoped stats for customers", async () => {
    const res = await request(app).get("/api/stats").set("Authorization", `Bearer ${ava}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.stats).toMatchObject({
      total: expect.any(Number),
      categoryBreakdown: expect.any(Array),
      workerResponseRate: expect.objectContaining({
        accepted: expect.any(Number),
        rejected: expect.any(Number),
      }),
      flowCounts: expect.objectContaining({
        New: expect.any(Number),
        Completed: expect.any(Number),
      }),
      ticketsPerDay: expect.any(Array),
    });
    expect(res.body.data.stats.ticketsPerDay).toHaveLength(7);
    expect(res.body.data.stats.myAvgRating).toBeUndefined();
    expect(res.body.data.stats.myRatingTrend).toBeUndefined();
  });

  it("returns worker-scoped stats with rating fields for agents", async () => {
    const res = await request(app).get("/api/stats").set("Authorization", `Bearer ${maya}`);
    expect(res.status).toBe(200);
    expect(res.body.data.stats.highPriorityCount).toEqual(expect.any(Number));
    expect(res.body.data.stats.categoryBreakdown).toEqual(expect.any(Array));
    expect(res.body.data.stats.ratingTrend).toEqual(expect.any(Array));
    expect(res.body.data.stats.myAvgRating).toEqual(expect.any(Number));
    expect(res.body.data.stats.myRatingTrend).toEqual(expect.any(Array));
    expect(res.body.data.stats.ticketsPerDay).toHaveLength(7);
  });



  it("creates a ticket with a unique number and keeps official category empty", async () => {

    const res = await request(app)

      .post("/api/tickets")

      .set("Authorization", `Bearer ${ava}`)

      .send({ subject: "API test unique number", description: "Need a refund check for the extra invoice charge." });

    expect(res.status).toBe(201);

    expect(res.body.success).toBe(true);

    expect(res.body.data.ticket.ticketNumber).toMatch(/^TCK-\d{4}-\d{5}$/);

    expect(res.body.data.ticket.category).toBeNull();

    expect(res.body.data.ticket.suggestedWorkerIds).toEqual(expect.any(Array));

  });



  it("blocks New → Completed on the backend", async () => {

    const created = await request(app)

      .post("/api/tickets")

      .set("Authorization", `Bearer ${ava}`)

      .send({ subject: "Skip resolve test", description: "This should stay New until claimed." });

    const id = created.body.data.ticket.id as string;

    const res = await request(app)

      .patch(`/api/tickets/${id}/status`)

      .set("Authorization", `Bearer ${maya}`)

      .send({ status: "Completed", resolutionNote: "should fail" });

    expect(res.status).toBe(409);

    expect(res.body.error).toMatch(/Cannot move from New/);

  });



  it("rejects complete without a note", async () => {

    const created = await request(app)

      .post("/api/tickets")

      .set("Authorization", `Bearer ${ava}`)

      .send({ subject: "Need note to resolve", description: "Agent must attach a resolution note." });

    const id = created.body.data.ticket.id as string;

    await request(app)

      .patch(`/api/tickets/${id}/select-worker`)

      .set("Authorization", `Bearer ${ava}`)

      .send({ workerId: mayaId });

    await request(app)

      .patch(`/api/tickets/${id}/respond`)

      .set("Authorization", `Bearer ${maya}`)

      .send({ action: "accept", urgency: "MEDIUM" });

    await request(app)

      .patch(`/api/tickets/${id}/status`)

      .set("Authorization", `Bearer ${maya}`)

      .send({ status: "InProgress" });

    const res = await request(app)

      .patch(`/api/tickets/${id}/status`)

      .set("Authorization", `Bearer ${maya}`)

      .send({ status: "Completed", resolutionNote: "   " });

    expect(res.status).toBe(400);

  });



  it("hides another customer ticket with 404", async () => {

    const created = await request(app)

      .post("/api/tickets")

      .set("Authorization", `Bearer ${ava}`)

      .send({ subject: "Private ava ticket", description: "Noah should not be able to open this." });

    const res = await request(app)

      .get(`/api/tickets/${created.body.data.ticket.id}`)

      .set("Authorization", `Bearer ${noah}`);

    expect(res.status).toBe(404);

  });



  it("accepts an incoming booking with urgency via respond", async () => {

    const created = await request(app)

      .post("/api/tickets")

      .set("Authorization", `Bearer ${ava}`)

      .send({ subject: "Respond accept test", description: "Need help with a duplicate billing charge on the invoice." });

    const id = created.body.data.ticket.id as string;

    await request(app)

      .patch(`/api/tickets/${id}/select-worker`)

      .set("Authorization", `Bearer ${ava}`)

      .send({ workerId: mayaId });

    const res = await request(app)

      .patch(`/api/tickets/${id}/respond`)

      .set("Authorization", `Bearer ${maya}`)

      .send({ action: "accept", urgency: "HIGH" });

    expect(res.status).toBe(200);

    expect(res.body.data.ticket.status).toBe("Accepted");

    expect(res.body.data.ticket.urgency).toBe("HIGH");

    expect(res.body.data.ticket.assignedAgentId).toBe(mayaId);

  });



  it("rejects an incoming booking via respond with a reason", async () => {

    const created = await request(app)

      .post("/api/tickets")

      .set("Authorization", `Bearer ${ava}`)

      .send({ subject: "Respond reject test", description: "Need help reviewing a possible duplicate billing charge." });

    const id = created.body.data.ticket.id as string;

    await request(app)

      .patch(`/api/tickets/${id}/select-worker`)

      .set("Authorization", `Bearer ${ava}`)

      .send({ workerId: mayaId });

    const res = await request(app)

      .patch(`/api/tickets/${id}/respond`)

      .set("Authorization", `Bearer ${maya}`)

      .send({ action: "reject", rejectionReason: "Fully booked this week" });

    expect(res.status).toBe(200);

    expect(res.body.data.action).toBe("reject");

    expect(res.body.data.ticket.status).toBe("Rejected");

    expect(res.body.data.ticket.rejectionReason).toBe("Fully booked this week");

  });



  it("cancels a booking while pending worker response", async () => {
    const created = await request(app)
      .post("/api/tickets")
      .set("Authorization", `Bearer ${ava}`)
      .send({ subject: "Cancel pending test", description: "Need help with a billing question I resolved myself." });
    const id = created.body.data.ticket.id as string;
    await request(app)
      .patch(`/api/tickets/${id}/select-worker`)
      .set("Authorization", `Bearer ${ava}`)
      .send({ workerId: mayaId });
    const res = await request(app)
      .patch(`/api/tickets/${id}/cancel`)
      .set("Authorization", `Bearer ${ava}`);
    expect(res.status).toBe(200);
    expect(res.body.data.ticket.status).toBe("Cancelled");
  });

  it("submits a worker rating for a completed ticket", async () => {
    const created = await request(app)
      .post("/api/tickets")
      .set("Authorization", `Bearer ${ava}`)
      .send({ subject: "Rate worker test", description: "Need help with a billing export issue on the invoice." });
    const id = created.body.data.ticket.id as string;
    await request(app)
      .patch(`/api/tickets/${id}/select-worker`)
      .set("Authorization", `Bearer ${ava}`)
      .send({ workerId: mayaId });
    await request(app)
      .patch(`/api/tickets/${id}/respond`)
      .set("Authorization", `Bearer ${maya}`)
      .send({ action: "accept", urgency: "MEDIUM" });
    await request(app)
      .patch(`/api/tickets/${id}/status`)
      .set("Authorization", `Bearer ${maya}`)
      .send({ status: "InProgress" });
    await request(app)
      .patch(`/api/tickets/${id}/status`)
      .set("Authorization", `Bearer ${maya}`)
      .send({ status: "Completed", resolutionNote: "Export issue fixed and verified." });

    const res = await request(app)
      .post(`/api/tickets/${id}/rating`)
      .set("Authorization", `Bearer ${ava}`)
      .send({ stars: 5, comment: "Great support" });
    expect(res.status).toBe(201);
    expect(res.body.data.rating.stars).toBe(5);
    expect(res.body.data.rating.comment).toBe("Great support");

    const stats = await request(app).get("/api/stats").set("Authorization", `Bearer ${maya}`);
    expect(stats.body.data.stats.myAvgRating).toBeGreaterThan(0);
    expect(stats.body.data.stats.myRatingTrend.at(-1)?.stars).toBe(5);
  });

  it("blocks duplicate ratings for the same ticket", async () => {
    const created = await request(app)
      .post("/api/tickets")
      .set("Authorization", `Bearer ${noah}`)
      .send({ subject: "Duplicate rating test", description: "Need help exporting billing data from the dashboard." });
    const id = created.body.data.ticket.id as string;
    const leoSession = await login("leo@lumen.dev");
    const leoId = leoSession.userId ?? "";
    await request(app)
      .patch(`/api/tickets/${id}/select-worker`)
      .set("Authorization", `Bearer ${noah}`)
      .send({ workerId: leoId });
    await request(app)
      .patch(`/api/tickets/${id}/respond`)
      .set("Authorization", `Bearer ${leoSession.token}`)
      .send({ action: "accept", urgency: "LOW" });
    await request(app)
      .patch(`/api/tickets/${id}/status`)
      .set("Authorization", `Bearer ${leoSession.token}`)
      .send({ status: "InProgress" });
    await request(app)
      .patch(`/api/tickets/${id}/status`)
      .set("Authorization", `Bearer ${leoSession.token}`)
      .send({ status: "Completed", resolutionNote: "Export works after cache refresh." });

    const first = await request(app)
      .post(`/api/tickets/${id}/rating`)
      .set("Authorization", `Bearer ${noah}`)
      .send({ stars: 4 });
    expect(first.status).toBe(201);
    const second = await request(app)
      .post(`/api/tickets/${id}/rating`)
      .set("Authorization", `Bearer ${noah}`)
      .send({ stars: 3 });
    expect(second.status).toBe(409);
  });

  it("clears the refresh cookie on logout", async () => {

    const session = await login("ava@lumen.dev");

    const res = await request(app)

      .post("/api/auth/logout")

      .set("Authorization", `Bearer ${session.token}`)

      .set("Cookie", session.cookie);

    expect(res.status).toBe(200);

    expect(res.body.success).toBe(true);

    expect(String(res.headers["set-cookie"])).toMatch(/lumen_refresh=/);

  });

});

