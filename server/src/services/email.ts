import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import { config } from "../config.js";

export type EmailPayload = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

let cachedTransporter: Transporter | null = null;

export function isEmailConfigured(): boolean {
  return Boolean(config.smtpHost && config.smtpUser);
}

export function getTransporter(): Transporter | null {
  if (cachedTransporter) return cachedTransporter;
  if (!isEmailConfigured()) return null;
  cachedTransporter = nodemailer.createTransport({
    host: config.smtpHost,
    port: config.smtpPort,
    secure: config.smtpSecure,
    auth: {
      user: config.smtpUser,
      pass: config.smtpPass,
    },
  });
  return cachedTransporter;
}

export function setTestTransporter(transporter: Transporter | null) {
  cachedTransporter = transporter;
}

export async function sendEmail(payload: EmailPayload): Promise<{ success: boolean; messageId?: string; mocked?: boolean; error?: string }> {
  try {
    const transporter = getTransporter();
    if (!transporter) {
      console.log(
        `\n📨 [EMAIL (Dev Preview)]\nTo: ${payload.to}\nSubject: ${payload.subject}\nFrom: ${config.emailFrom}\n--- Body ---\n${payload.text}\n----------------\n`,
      );
      return { success: true, mocked: true, messageId: `mock-${Date.now()}` };
    }

    const info = await transporter.sendMail({
      from: config.emailFrom,
      to: payload.to,
      subject: payload.subject,
      text: payload.text,
      html: payload.html,
    });

    return { success: true, messageId: info.messageId };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error(`[EMAIL ERROR] Failed to send email to ${payload.to}:`, errorMsg);
    return { success: false, error: errorMsg };
  }
}


/** Non-blocking fire-and-forget email helper */
export function fireAndForgetEmail(payload: EmailPayload) {
  setImmediate(() => {
    void sendEmail(payload).catch((err) => {
      console.error("[EMAIL UNCAUGHT]", err);
    });
  });
}

function emailLayout(title: string, contentHtml: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body { margin: 0; padding: 0; background-color: #0d0e12; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #e2e8f0; }
    .wrapper { width: 100%; max-width: 600px; margin: 0 auto; padding: 24px 16px; box-sizing: border-box; }
    .card { background-color: #14161f; border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 16px; padding: 32px 24px; box-shadow: 0 10px 25px rgba(0, 0, 0, 0.5); }
    .brand { display: inline-flex; align-items: center; gap: 8px; font-size: 20px; font-weight: 700; color: #ffffff; letter-spacing: -0.02em; margin-bottom: 24px; }
    .brand-accent { color: #ff5722; }
    .badge { display: inline-block; padding: 4px 10px; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; border-radius: 9999px; background: rgba(255, 87, 34, 0.15); color: #ff784e; margin-bottom: 16px; }
    h1 { font-size: 22px; font-weight: 600; color: #ffffff; margin: 0 0 12px 0; line-height: 1.3; }
    p { font-size: 14px; line-height: 1.6; color: #94a3b8; margin: 0 0 16px 0; }
    .highlight-box { background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.06); border-radius: 12px; padding: 16px; margin: 20px 0; }
    .meta-row { display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 8px; color: #cbd5e1; }
    .meta-label { color: #64748b; }
    .btn { display: inline-block; background-color: #ff5722; color: #ffffff !important; text-decoration: none; font-weight: 600; font-size: 14px; padding: 12px 24px; border-radius: 9999px; text-align: center; margin-top: 16px; }
    .footer { text-align: center; font-size: 12px; color: #475569; margin-top: 24px; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="card">
      <div class="brand">
        <span class="brand-accent">●</span> Solace Desk
      </div>
      ${contentHtml}
    </div>
    <div class="footer">
      This is an automated notification from Solace AI-Assisted Customer Desk.
    </div>
  </div>
</body>
</html>`;
}

export function sendTicketCreatedEmail(ticket: {
  id: string;
  ticketNumber: string;
  subject: string;
  description: string;
  category?: string | null;
  aiCategory?: string | null;
  priority?: string | null;
  aiPriority?: string | null;
}, customer: { name: string; email: string }) {
  const url = `${config.appBaseUrl}/customer/tickets/${ticket.id}`;
  const category = ticket.category || ticket.aiCategory || "Pending AI Triage";
  const priority = ticket.priority || ticket.aiPriority || "Assessing";

  const contentHtml = `
    <div class="badge">Ticket Created</div>
    <h1>We received your ticket, ${customer.name}</h1>
    <p>Your support request has been logged and assigned ticket number <strong>${ticket.ticketNumber}</strong>. Our AI has triaged your issue and it is now ready for specialist attention.</p>
    
    <div class="highlight-box">
      <div class="meta-row"><span class="meta-label">Ticket ID:</span> <strong>${ticket.ticketNumber}</strong></div>
      <div class="meta-row"><span class="meta-label">Subject:</span> <span>${ticket.subject}</span></div>
      <div class="meta-row"><span class="meta-label">Category:</span> <span>${category}</span></div>
      <div class="meta-row"><span class="meta-label">Priority:</span> <span>${priority}</span></div>
    </div>

    <p>You can view updates or select a dedicated worker through your portal:</p>
    <a href="${url}" class="btn">View Your Ticket</a>
  `;

  const text = `Hello ${customer.name},

Your support request "${ticket.subject}" has been received.
Ticket Number: ${ticket.ticketNumber}
Category: ${category}
Priority: ${priority}

View your ticket online: ${url}

- Solace Support Desk`;

  return sendEmail({
    to: customer.email,
    subject: `[${ticket.ticketNumber}] Ticket Received: ${ticket.subject}`,
    html: emailLayout(`Ticket Created - ${ticket.ticketNumber}`, contentHtml),
    text,
  });
}

export async function sendWorkerAssignedEmail(
  ticket: { id: string; ticketNumber: string; subject: string; description: string; priority?: string | null },
  worker: { name: string; email: string },
  customer: { name: string },
) {
  const url = `${config.appBaseUrl}/worker/tickets/${ticket.id}`;

  const contentHtml = `
    <div class="badge">New Assignment</div>
    <h1>New Ticket Assigned</h1>
    <p>Hello ${worker.name}, customer <strong>${customer.name}</strong> has a ticket waiting for your response.</p>
    
    <div class="highlight-box">
      <div class="meta-row"><span class="meta-label">Ticket ID:</span> <strong>${ticket.ticketNumber}</strong></div>
      <div class="meta-row"><span class="meta-label">Subject:</span> <span>${ticket.subject}</span></div>
      <div class="meta-row"><span class="meta-label">Customer:</span> <span>${customer.name}</span></div>
    </div>

    <p>${ticket.description.slice(0, 200)}${ticket.description.length > 200 ? "..." : ""}</p>
    <a href="${url}" class="btn">Open Ticket in Dashboard</a>
  `;

  const text = `Hello ${worker.name},

You have a new ticket assignment from ${customer.name}.
Ticket: [${ticket.ticketNumber}] ${ticket.subject}

Open in dashboard: ${url}

- Solace Desk`;

  return sendEmail({
    to: worker.email,
    subject: `[${ticket.ticketNumber}] New Ticket Assignment: ${ticket.subject}`,
    html: emailLayout(`New Ticket Assignment - ${ticket.ticketNumber}`, contentHtml),
    text,
  });
}

export async function sendNewMessageEmail(
  ticket: { id: string; ticketNumber: string; subject: string },
  messageBody: string,
  sender: { name: string; role: string },
  recipient: { name: string; email: string; role: string },
) {
  const rolePath = recipient.role === "CUSTOMER" ? "customer" : "worker";
  const url = `${config.appBaseUrl}/${rolePath}/tickets/${ticket.id}`;

  const contentHtml = `
    <div class="badge">New Message</div>
    <h1>New reply from ${sender.name}</h1>
    <p>There is a new update on ticket <strong>${ticket.ticketNumber}</strong>:</p>
    
    <div class="highlight-box" style="border-left: 3px solid #ff5722;">
      <p style="color: #f1f5f9; font-size: 14px; margin: 0; white-space: pre-wrap;">${messageBody}</p>
    </div>

    <a href="${url}" class="btn">Reply to Message</a>
  `;

  const text = `Hello ${recipient.name},

${sender.name} replied on ticket [${ticket.ticketNumber}] ${ticket.subject}:

"${messageBody}"

View and reply: ${url}

- Solace Desk`;

  return sendEmail({
    to: recipient.email,
    subject: `[${ticket.ticketNumber}] New message from ${sender.name}`,
    html: emailLayout(`New Message - ${ticket.ticketNumber}`, contentHtml),
    text,
  });
}

export async function sendTicketResolvedEmail(
  ticket: { id: string; ticketNumber: string; subject: string },
  customer: { name: string; email: string },
  resolutionNote: string,
  workerName: string,
) {
  const url = `${config.appBaseUrl}/customer/tickets/${ticket.id}`;

  const contentHtml = `
    <div class="badge" style="background: rgba(34, 197, 94, 0.15); color: #4ade80;">Resolved</div>
    <h1>Your ticket has been resolved</h1>
    <p>Hello ${customer.name}, <strong>${workerName}</strong> has completed work on your ticket.</p>
    
    <div class="highlight-box">
      <div class="meta-row"><span class="meta-label">Ticket ID:</span> <strong>${ticket.ticketNumber}</strong></div>
      <div class="meta-row"><span class="meta-label">Subject:</span> <span>${ticket.subject}</span></div>
      <div class="meta-row"><span class="meta-label">Resolution Note:</span></div>
      <p style="color: #f1f5f9; margin-top: 6px; font-style: italic;">"${resolutionNote}"</p>
    </div>

    <p>Please take a moment to rate your experience and leave feedback for ${workerName}:</p>
    <a href="${url}" class="btn">Rate Support Experience</a>
  `;

  const text = `Hello ${customer.name},

Your ticket [${ticket.ticketNumber}] ${ticket.subject} has been resolved by ${workerName}.

Resolution Note:
"${resolutionNote}"

Please visit your ticket to rate your experience: ${url}

- Solace Support Desk`;

  return sendEmail({
    to: customer.email,
    subject: `[${ticket.ticketNumber}] Ticket Resolved: ${ticket.subject}`,
    html: emailLayout(`Ticket Resolved - ${ticket.ticketNumber}`, contentHtml),
    text,
  });
}

