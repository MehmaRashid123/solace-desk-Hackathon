import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./context/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}", "./views/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)", "Inter", "system-ui", "sans-serif"],
      },
      colors: {
        page: "var(--bg)",
        card: "var(--card)",
        surface: "var(--card)",
        surface2: "var(--card-2)",
        accent: "var(--accent)",
        "accent-2": "var(--accent-grad-start)",
        "accent-3": "var(--accent-grad-end)",
        success: "var(--success)",
        danger: "var(--danger)",
        primary: "var(--text-primary)",
        secondary: "var(--text-secondary)",
        muted: "var(--text-secondary)",
        chart: "var(--chart-2)",
        ink: {
          950: "var(--bg)",
          900: "var(--card)",
          800: "var(--card-2)",
        },
      },
      borderColor: {
        card: "var(--card-border)",
        DEFAULT: "var(--card-border)",
      },
      borderRadius: {
        card: "var(--radius-card)",
        pill: "var(--radius-pill)",
      },
      backgroundImage: {
        "accent-gradient": "linear-gradient(135deg, var(--accent-grad-start), var(--accent-grad-end))",
      },
      width: {
        sidebar: "var(--sidebar)",
      },
    },
  },
  plugins: [],
};

export default config;
