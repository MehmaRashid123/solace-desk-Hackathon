/** Design tokens — mirrored in `app/globals.css` and `tailwind.config.ts`. */
export const theme = {
  bg: "#0A0A0A",
  card: "#141414",
  cardBorder: "rgba(255,255,255,0.08)",
  accent: "#FF5722",
  accentStart: "#FF7A45",
  accentEnd: "#FF3D1F",
  success: "#22C55E",
  danger: "#EF4444",
  textPrimary: "#FFFFFF",
  textSecondary: "#9CA3AF",
  chart: "#8B5CF6",
  radiusCard: 18,
  radiusPill: 999,
} as const;

export type ThemeTokens = typeof theme;
