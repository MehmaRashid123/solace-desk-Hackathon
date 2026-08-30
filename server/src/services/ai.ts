import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { config } from "../config.js";

export type AiSource = "openai" | "anthropic" | "fallback";

export const TRIAGE_PROMPT =
  "Classify this support ticket. Return strict JSON: {category, priority, summary}. Categories: Billing, Technical, Account, General. Priority: Low, Medium, High.";

export type RawTriage = {
  category: string;
  priority: string;
  summary: string;
};

export type TriageInput = {
  title: string;
  description?: string;
  messages: Array<{ role: "user" | "assistant"; content: string }>;
};

export type TriageOutput = {
  text: string;
  source: AiSource;
  raw: RawTriage;
};

export type AiProvider = {
  name: Exclude<AiSource, "fallback">;
  classify: (userContent: string) => Promise<string>;
};

export type AiService = {
  triage: (input: TriageInput) => Promise<TriageOutput>;
  draftResolution: (input: TriageInput) => Promise<string>;
  draftRating: (input: TriageInput & { workerName: string; resolutionNote?: string | null }) => Promise<{ stars: number; comment: string }>;
};

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("AI_TIMEOUT")), ms);
  });
  return Promise.race([promise, timeout]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

export function parseRawTriage(text: string): RawTriage {
  try {
    const jsonStart = text.indexOf("{");
    const jsonEnd = text.lastIndexOf("}");
    if (jsonStart < 0 || jsonEnd <= jsonStart) {
      throw new Error("AI_INVALID_JSON");
    }
    const parsed = JSON.parse(text.slice(jsonStart, jsonEnd + 1)) as Partial<RawTriage>;
    return {
      category: parsed.category == null ? "" : String(parsed.category),
      priority: parsed.priority == null ? "" : String(parsed.priority),
      summary: parsed.summary == null ? "" : String(parsed.summary),
    };
  } catch {
    throw new Error("AI_INVALID_JSON");
  }
}

export const RESOLVE_PROMPT =
  "Write a short resolution note for this support ticket. Return strict JSON: {summary}. Two or three sentences, past tense, what was done.";

export function parseResolutionSummary(text: string): string {
  try {
    const jsonStart = text.indexOf("{");
    const jsonEnd = text.lastIndexOf("}");
    if (jsonStart >= 0 && jsonEnd > jsonStart) {
      const parsed = JSON.parse(text.slice(jsonStart, jsonEnd + 1)) as { summary?: unknown };
      const summary = parsed.summary == null ? "" : String(parsed.summary).trim();
      if (summary) return summary.slice(0, 2000);
    }
  } catch {
    /* use plain text below */
  }
  const cleaned = text.replace(/```json|```/g, "").trim();
  if (cleaned && !cleaned.startsWith("{")) return cleaned.slice(0, 2000);
  throw new Error("AI_INVALID_JSON");
}

export function fallbackResolution(input: TriageInput): string {
  const detail = (input.description ?? input.title).trim();
  return `Reviewed and resolved: ${input.title}. ${detail}`.slice(0, 2000);
}

export const RATING_PROMPT =
  "Draft a customer review for the support worker who handled this ticket. Return strict JSON: {stars, comment}. stars is 1-5 integer. comment is one or two friendly sentences in the customer's voice.";

export type RawRating = { stars: number; comment: string };

export function parseRatingDraft(text: string): RawRating {
  try {
    const jsonStart = text.indexOf("{");
    const jsonEnd = text.lastIndexOf("}");
    if (jsonStart >= 0 && jsonEnd > jsonStart) {
      const parsed = JSON.parse(text.slice(jsonStart, jsonEnd + 1)) as { stars?: unknown; comment?: unknown };
      const stars = Math.min(5, Math.max(1, Math.round(Number(parsed.stars) || 4)));
      const comment = parsed.comment == null ? "" : String(parsed.comment).trim();
      if (comment) return { stars, comment: comment.slice(0, 2000) };
    }
  } catch {
    /* fall through */
  }
  throw new Error("AI_INVALID_JSON");
}

export function fallbackRating(input: TriageInput & { workerName: string }): RawRating {
  return {
    stars: 4,
    comment: `${input.workerName} handled my request professionally and got everything sorted.`.slice(0, 2000),
  };
}

export function fallbackTriage(input: TriageInput): RawTriage {
  const blob = `${input.title} ${input.description ?? ""} ${input.messages.map((m) => m.content).join(" ")}`.toLowerCase();
  let category = "General";
  if (/(bill|invoice|charge|refund|payment|stripe)/.test(blob)) category = "Billing";
  else if (/(login|sso|crash|bug|error|export|csv|chrome|api)/.test(blob)) category = "Technical";
  else if (/(password|owner|transfer|email|account|workspace)/.test(blob)) category = "Account";

  let priority = "Medium";
  if (/(urgent|down|twice|can't|cannot|blocked|outage)/.test(blob)) priority = "High";
  else if (/(typo|question|how do i|missing column)/.test(blob)) priority = "Low";

  return {
    category,
    priority,
    summary: input.title,
  };
}

function openaiProvider(apiKey: string): AiProvider {
  return {
    name: "openai",
    async classify(userContent) {
      const client = new OpenAI({ apiKey });
      const response = await client.chat.completions.create({
        model: "gpt-4o-mini",
        temperature: 0.1,
        messages: [
          { role: "system", content: TRIAGE_PROMPT },
          { role: "user", content: userContent },
        ],
      });
      return response.choices[0]?.message?.content?.trim() || "";
    },
  };
}

function anthropicProvider(apiKey: string): AiProvider {
  return {
    name: "anthropic",
    async classify(userContent) {
      const client = new Anthropic({ apiKey });
      const response = await client.messages.create({
        model: "claude-3-5-haiku-latest",
        max_tokens: 400,
        temperature: 0.1,
        system: TRIAGE_PROMPT,
        messages: [{ role: "user", content: userContent }],
      });
      const block = response.content.find((part) => part.type === "text");
      return block && block.type === "text" ? block.text.trim() : "";
    },
  };
}

function toUserContent(input: TriageInput) {
  const thread = input.messages
    .map((m) => `${m.role === "user" ? "Customer" : "Agent"}: ${m.content}`)
    .join("\n");
  return `Title: ${input.title}\nDescription: ${input.description ?? ""}\n\nThread:\n${thread || "(empty)"}`;
}

export function createAiService(deps?: {
  providers?: AiProvider[];
  timeoutMs?: number;
  fallback?: (input: TriageInput) => RawTriage;
}): AiService {
  const timeoutMs = deps?.timeoutMs ?? config.aiTimeoutMs;
  const fallback = deps?.fallback ?? fallbackTriage;
  const providers =
    deps?.providers ??
    [
      config.openaiKey ? openaiProvider(config.openaiKey) : null,
      config.anthropicKey ? anthropicProvider(config.anthropicKey) : null,
    ].filter((p): p is AiProvider => Boolean(p));

  return {
    async triage(input) {
      const userContent = toUserContent(input);
      if (providers.length === 0) {
        const raw = fallback(input);
        return { text: JSON.stringify(raw), source: "fallback" as const, raw };
      }
      for (const provider of providers) {
        try {
          const text = await withTimeout(provider.classify(userContent), timeoutMs);
          if (!text) throw new Error("AI_EMPTY");
          return { text, source: provider.name, raw: parseRawTriage(text) };
        } catch (err) {
          console.warn("AI provider failed, trying next:", err instanceof Error ? err.message : err);
        }
      }
      throw new Error("AI_ALL_PROVIDERS_FAILED");
    },
    async draftResolution(input) {
      const userContent = `${RESOLVE_PROMPT}\n\n${toUserContent(input)}`;
      if (providers.length === 0) return fallbackResolution(input);
      for (const provider of providers) {
        try {
          const text = await withTimeout(provider.classify(userContent), timeoutMs);
          if (!text) throw new Error("AI_EMPTY");
          return parseResolutionSummary(text);
        } catch (err) {
          console.warn("AI resolution draft failed:", err instanceof Error ? err.message : err);
        }
      }
      return fallbackResolution(input);
    },
    async draftRating(input) {
      const userContent = `${RATING_PROMPT}\nWorker: ${input.workerName}\nResolution: ${input.resolutionNote ?? "n/a"}\n\n${toUserContent(input)}`;
      if (providers.length === 0) return fallbackRating(input);
      for (const provider of providers) {
        try {
          const text = await withTimeout(provider.classify(userContent), timeoutMs);
          if (!text) throw new Error("AI_EMPTY");
          return parseRatingDraft(text);
        } catch (err) {
          console.warn("AI rating draft failed:", err instanceof Error ? err.message : err);
        }
      }
      return fallbackRating(input);
    },
  };
}

export const aiService = createAiService();

export function runTriagePrompt(input: TriageInput) {
  return aiService.triage(input);
}

export function draftResolutionNote(input: TriageInput) {
  return aiService.draftResolution(input);
}

export function draftRatingReview(input: TriageInput & { workerName: string; resolutionNote?: string | null }) {
  return aiService.draftRating(input);
}
