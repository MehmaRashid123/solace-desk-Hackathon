import { beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";
import {
  sendEmail,
  sendNewMessageEmail,
  sendTicketCreatedEmail,
  sendTicketResolvedEmail,
  sendWorkerAssignedEmail,
  setTestTransporter,
} from "../src/services/email.js";

const app = createApp();

async function login(email: string) {
  const res = await request(app).post("/api/auth/login").send({ email, password: "password123" });
  return {
    token: res.body?.data?.accessToken as string | undefined,
    userId: res.body?.data?.user?.id as string | undefined,
  };
}

describe("Email Notification System", () => {
  let capturedMails: Array<{ to?: string; subject?: string; text?: string; html?: string }> = [];

  beforeAll(() => {
    // Setup mock transporter to capture all sent emails during tests
    setTestTransporter({
      sendMail: async (mailOptions: { to?: string; subject?: string; text?: string; html?: string }) => {
        capturedMails.push(mailOptions);
        return { messageId: `test-${Date.now()}` };
      },
    } as any);
  });

  it("sends email via transporter when configured", async () => {
    const res = await sendEmail({
      to: "customer@example.com",
      subject: "Test Subject",
      text: "Plain text body",
      html: "<p>HTML body</p>",
    });

    expect(res.success).toBe(true);
    expect(res.messageId).toBeTruthy();
    expect(capturedMails.some((m) => m.to === "customer@example.com" && m.subject === "Test Subject")).toBe(true);
  });

  it("creates branded ticket creation email", async () => {
    capturedMails = [];
    await sendTicketCreatedEmail(
      {
        id: "tick-123",
        ticketNumber: "TCK-2026-00001",
        subject: "Cannot login to dashboard",
        description: "Password reset is not sending code.",
        category: "Technical",
        priority: "HIGH",
      },
      { name: "Ava Patel", email: "ava@lumen.dev" },
    );

    expect(capturedMails.length).toBeGreaterThan(0);
    const mail = capturedMails[0];
    expect(mail.to).toBe("ava@lumen.dev");
    expect(mail.subject).toContain("TCK-2026-00001");
    expect(mail.html).toContain("Cannot login to dashboard");
    expect(mail.html).toContain("Solace Desk");
    expect(mail.text).toContain("Technical");
  });

  it("creates worker assignment notification email", async () => {
    capturedMails = [];
    await sendWorkerAssignedEmail(
      {
        id: "tick-456",
        ticketNumber: "TCK-2026-00002",
        subject: "Billing double charge",
        description: "Need refund for the second transaction.",
      },
      { name: "Maya Okonkwo", email: "maya@lumen.dev" },
      { name: "Noah Kim" },
    );

    expect(capturedMails.length).toBeGreaterThan(0);
    const mail = capturedMails[0];
    expect(mail.to).toBe("maya@lumen.dev");
    expect(mail.subject).toContain("New Ticket Assignment");
    expect(mail.html).toContain("Noah Kim");
  });

  it("creates new message notification email", async () => {
    capturedMails = [];
    await sendNewMessageEmail(
      {
        id: "tick-789",
        ticketNumber: "TCK-2026-00003",
        subject: "Export CSV failing",
      },
      "I have attached the debug logs for your review.",
      { name: "Ava Patel", role: "CUSTOMER" },
      { name: "Maya Okonkwo", email: "maya@lumen.dev", role: "AGENT" },
    );

    expect(capturedMails.length).toBeGreaterThan(0);
    const mail = capturedMails[0];
    expect(mail.to).toBe("maya@lumen.dev");
    expect(mail.subject).toContain("New message from Ava Patel");
    expect(mail.text).toContain("attached the debug logs");
  });

  it("creates ticket resolved notification email with resolution note", async () => {
    capturedMails = [];
    await sendTicketResolvedEmail(
      {
        id: "tick-999",
        ticketNumber: "TCK-2026-00004",
        subject: "Refund request",
      },
      { name: "Ava Patel", email: "ava@lumen.dev" },
      "Refund of $49.00 processed via Stripe. Receipt sent.",
      "Maya Okonkwo",
    );

    expect(capturedMails.length).toBeGreaterThan(0);
    const mail = capturedMails[0];
    expect(mail.to).toBe("ava@lumen.dev");
    expect(mail.subject).toContain("Ticket Resolved");
    expect(mail.html).toContain("Refund of $49.00 processed");
    expect(mail.html).toContain("Maya Okonkwo");
  });


  it("triggers emails during end-to-end ticket lifecycle via API", async () => {
    const customer = await login("ava@lumen.dev");
    const agent = await login("maya@lumen.dev");

    capturedMails = [];

    // 1. Customer creates ticket -> should send creation email
    const createRes = await request(app)
      .post("/api/tickets")
      .set("Authorization", `Bearer ${customer.token}`)
      .send({
        subject: "E2E Email Lifecycle Test",
        description: "Checking if email notifications fire on every step.",
      });

    expect(createRes.status).toBe(201);
    const ticketId = createRes.body.data.ticket.id;
    expect(capturedMails.some((m) => m.to === "ava@lumen.dev" && m.subject?.includes("Ticket Received"))).toBe(true);

    // 2. Select Worker -> should send worker assignment email
    capturedMails = [];
    const selectRes = await request(app)
      .patch(`/api/tickets/${ticketId}/select-worker`)
      .set("Authorization", `Bearer ${customer.token}`)
      .send({ workerId: agent.userId });

    expect(selectRes.status).toBe(200);
    expect(capturedMails.some((m) => m.to === "maya@lumen.dev" && m.subject?.includes("New Ticket Assignment"))).toBe(true);

    // 3. Worker responds and accepts
    await request(app)
      .patch(`/api/tickets/${ticketId}/respond`)
      .set("Authorization", `Bearer ${agent.token}`)
      .send({ action: "accept", urgency: "MEDIUM" });

    // 4. Send a message -> should send message email to other party
    capturedMails = [];
    const msgRes = await request(app)
      .post(`/api/tickets/${ticketId}/messages`)
      .set("Authorization", `Bearer ${customer.token}`)
      .send({ body: "Hi Maya, any updates on this?" });

    expect(msgRes.status).toBe(201);

    // 5. Worker progresses and completes ticket with resolution note -> should send resolved email
    await request(app)
      .patch(`/api/tickets/${ticketId}/status`)
      .set("Authorization", `Bearer ${agent.token}`)
      .send({ status: "InProgress" });

    capturedMails = [];
    const resolveRes = await request(app)
      .patch(`/api/tickets/${ticketId}/status`)
      .set("Authorization", `Bearer ${agent.token}`)
      .send({ status: "Completed", resolutionNote: "All verified and resolved." });

    expect(resolveRes.status).toBe(200);
    expect(capturedMails.some((m) => m.to === "ava@lumen.dev" && m.subject?.includes("Ticket Resolved"))).toBe(true);
  });
});
