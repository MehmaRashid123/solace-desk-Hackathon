export const OFFICIAL_CATEGORIES = ["Billing", "Technical", "Account", "General"] as const;
export type OfficialCategory = (typeof OFFICIAL_CATEGORIES)[number];
export type OfficialPriority = "LOW" | "MEDIUM" | "HIGH";

export function parseOfficialCategory(raw: string): OfficialCategory | null {
  const hit = OFFICIAL_CATEGORIES.find((c) => c.toLowerCase() === raw.trim().toLowerCase());
  return hit ?? null;
}

export function parseOfficialPriority(raw: string): OfficialPriority | null {
  const value = raw.trim().toUpperCase();
  if (value === "LOW" || value === "MEDIUM" || value === "HIGH") return value;
  return null;
}

export function requireOfficialCategory(raw: string): OfficialCategory {
  const parsed = parseOfficialCategory(raw);
  if (!parsed) {
    throw new Error("category must be Billing, Technical, Account, or General");
  }
  return parsed;
}

export function requireOfficialPriority(raw: string): OfficialPriority {
  const parsed = parseOfficialPriority(raw);
  if (!parsed) {
    throw new Error("priority must be Low, Medium, or High");
  }
  return parsed;
}
