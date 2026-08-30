import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  await prisma.workerRating.deleteMany();
  await prisma.message.deleteMany();
  await prisma.ticketEvent.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.ticket.deleteMany();
  await prisma.ticketSequence.deleteMany();
  await prisma.user.deleteMany();

  const passwordHash = await bcrypt.hash("password123", 12);

  const [admin, agentMaya, agentLeo, customerAva, customerNoah] = await Promise.all([
    prisma.user.create({
      data: { name: "Aria Chen", email: "admin@lumen.dev", passwordHash, role: "ADMIN", avatarHue: 268 },
    }),
    prisma.user.create({
      data: {
        name: "Maya Okonkwo",
        email: "maya@lumen.dev",
        passwordHash,
        role: "AGENT",
        avatarHue: 168,
        category: "Billing",
        avgRating: 4.8,
        ratingCount: 12,
      },
    }),
    prisma.user.create({
      data: {
        name: "Leo Hart",
        email: "leo@lumen.dev",
        passwordHash,
        role: "AGENT",
        avatarHue: 28,
        category: "Account",
        avgRating: 4.5,
        ratingCount: 8,
      },
    }),
    prisma.user.create({
      data: { name: "Ava Patel", email: "ava@lumen.dev", passwordHash, role: "CUSTOMER", avatarHue: 330 },
    }),
    prisma.user.create({
      data: { name: "Noah Kim", email: "noah@lumen.dev", passwordHash, role: "CUSTOMER", avatarHue: 200 },
    }),
  ]);

  const t1 = await prisma.ticket.create({
    data: {
      ticketNumber: "TCK-2026-00001",
      subject: "Invoice charged twice after plan upgrade",
      description: "I upgraded to Pro yesterday and was billed the monthly fee twice. Charge IDs are ch_19 and ch_20.",
      status: "InProgress",
      priority: "HIGH",
      category: "Billing",
      customerId: customerAva.id,
      assignedAgentId: agentMaya.id,
      aiSummary: "Duplicate Pro-plan charge after upgrade. Customer provided two Stripe charge IDs.",
      aiCategory: "Billing",
      aiPriority: "High",
      aiFailed: false,
      aiConfidenceRaw: { source: "seed", category: "Billing", priority: "High", confidence: 0.91 },
    },
  });

  const t2 = await prisma.ticket.create({
    data: {
      ticketNumber: "TCK-2026-00002",
      subject: "SSO login loop on Chrome",
      description: "Google SSO redirects back to /login in an endless loop. Happens only on Chrome 128, Firefox is fine.",
      status: "New",
      priority: null,
      category: null,
      customerId: customerNoah.id,
      suggestedWorkerIds: [agentLeo.id],
      aiSummary: "Chrome-only SSO redirect loop. Likely cookie/SameSite issue on the callback.",
      aiCategory: "Technical",
      aiPriority: "High",
      aiFailed: false,
      aiConfidenceRaw: { source: "seed", category: "technical", priority: "HIGH", confidence: 0.84 },
    },
  });

  const t3 = await prisma.ticket.create({
    data: {
      ticketNumber: "TCK-2026-00003",
      subject: "Need to transfer workspace ownership",
      description: "I'm leaving the company Friday and need to transfer the Acme workspace to jordan@acme.io.",
      status: "PendingWorkerResponse",
      priority: "MEDIUM",
      category: "Account",
      customerId: customerAva.id,
      assignedAgentId: agentLeo.id,
      aiSummary: "Ownership transfer requested before Friday. Waiting on verification from current owner.",
      aiCategory: "Account",
      aiPriority: "Medium",
      aiFailed: false,
      aiConfidenceRaw: { source: "seed", category: "account", priority: "MEDIUM", confidence: 0.77 },
    },
  });

  const t4 = await prisma.ticket.create({
    data: {
      ticketNumber: "TCK-2026-00004",
      subject: "Export CSV missing last column",
      description: "The billing export drops the tax column when more than 500 rows are included.",
      status: "Completed",
      priority: "LOW",
      category: "Technical",
      customerId: customerNoah.id,
      assignedAgentId: agentMaya.id,
      resolutionNote: "Confirmed a off-by-one in the CSV serializer. Fix shipped in 1.8.4; Noah re-exported successfully.",
      aiSummary: "CSV export truncates the last column on large billing exports.",
      aiCategory: "Technical",
      aiPriority: "Low",
      aiFailed: false,
      aiConfidenceRaw: { source: "seed", category: "technical", priority: "LOW", confidence: 0.72 },
    },
  });

  await prisma.ticketSequence.create({ data: { year: 2026, last: 4 } });

  await prisma.message.createMany({
    data: [
      { ticketId: t1.id, senderId: customerAva.id, senderRole: "CUSTOMER", body: "I upgraded to Pro yesterday and was billed twice. Charge IDs ch_19 and ch_20." },
      { ticketId: t1.id, senderId: agentMaya.id, senderRole: "AGENT", body: "Thanks Ava — I can see both charges. I'll void ch_20 and email the credit confirmation." },
      { ticketId: t2.id, senderId: customerNoah.id, senderRole: "CUSTOMER", body: "Google SSO loops back to login on Chrome 128. Firefox works. Happening since this morning." },
      { ticketId: t3.id, senderId: customerAva.id, senderRole: "CUSTOMER", body: "Need to transfer Acme workspace ownership to jordan@acme.io before Friday." },
      { ticketId: t3.id, senderId: agentLeo.id, senderRole: "AGENT", body: "I can start the transfer. Please confirm jordan@acme.io is already a workspace admin." },
      { ticketId: t4.id, senderId: customerNoah.id, senderRole: "CUSTOMER", body: "Billing CSV is missing the tax column above 500 rows." },
      { ticketId: t4.id, senderId: agentMaya.id, senderRole: "AGENT", body: "Patched in 1.8.4 — please re-run the export and confirm the tax column is back." },
    ],
  });

  await prisma.ticketEvent.createMany({
    data: [
      { ticketId: t1.id, type: "ASSIGNED", fromValue: null, toValue: agentMaya.id, actorId: agentMaya.id },
      { ticketId: t1.id, type: "STATUS_CHANGE", fromValue: "New", toValue: "PendingWorkerResponse", actorId: agentMaya.id },
      { ticketId: t1.id, type: "STATUS_CHANGE", fromValue: "Accepted", toValue: "InProgress", actorId: agentMaya.id },
      { ticketId: t3.id, type: "ASSIGNED", fromValue: null, toValue: agentLeo.id, actorId: agentLeo.id },
      { ticketId: t3.id, type: "STATUS_CHANGE", fromValue: "New", toValue: "PendingWorkerResponse", actorId: agentLeo.id },
      { ticketId: t4.id, type: "ASSIGNED", fromValue: null, toValue: agentMaya.id, actorId: agentMaya.id },
      { ticketId: t4.id, type: "STATUS_CHANGE", fromValue: "New", toValue: "PendingWorkerResponse", actorId: agentMaya.id },
      { ticketId: t4.id, type: "STATUS_CHANGE", fromValue: "Accepted", toValue: "InProgress", actorId: agentMaya.id },
      { ticketId: t4.id, type: "STATUS_CHANGE", fromValue: "InProgress", toValue: "Completed", actorId: agentMaya.id },
    ],
  });

  await prisma.workerRating.create({
    data: {
      ticketId: t4.id,
      workerId: agentMaya.id,
      customerId: customerNoah.id,
      stars: 5,
      comment: "Maya fixed the CSV export quickly and explained the patch clearly. Great support!",
    },
  });

  await prisma.user.update({
    where: { id: agentMaya.id },
    data: { avgRating: 4.8, ratingCount: 1 },
  });

  await prisma.user.update({
    where: { id: agentLeo.id },
    data: { avgRating: 0, ratingCount: 0 },
  });

  console.log("Seeded Lumen desk");
  console.log("  admin@lumen.dev / password123");
  console.log("  maya@lumen.dev  / password123  (agent)");
  console.log("  leo@lumen.dev   / password123  (agent)");
  console.log("  ava@lumen.dev   / password123  (customer)");
  console.log("  noah@lumen.dev  / password123  (customer)");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
