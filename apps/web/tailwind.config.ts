import type { Config } from "tailwindcss";

export default {
  darkMode: ["selector", '[data-theme="dark"]'],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: { DEFAULT: "#ff006e", dark: "#dc005f" },
        text: { DEFAULT: "#f4f4f4", muted: "#a8a8a8" },
        surface: { DEFAULT: "#1e1e1e", light: "#292929" },
        error: "#ef4444",
        background: "var(--color-background)",
        surface1: "var(--color-surface-1)",
        surface2: "var(--color-surface-2)",
        accent: "var(--color-accent)",
        "accent-text": "var(--color-accent-text)",
        secondary: "var(--color-secondary)",
        foreground: "var(--color-foreground)",
        "foreground-muted": "var(--color-foreground-muted)",
        "foreground-on-accent": "var(--color-foreground-on-accent)",
        border: "var(--color-border)",
        focusring: "var(--color-focus-ring)",
        success: "var(--color-success)",
        warning: "var(--color-warning)",
        danger: "var(--color-danger)",
      },
      backgroundImage: {
        "gradient-primary": "var(--gradient-primary)",
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      borderRadius: {
        sm: "var(--radius-sm)",
        md: "var(--radius-md)",
        lg: "var(--radius-lg)",
      },
      spacing: {
        18: "4.5rem",
      },
      minHeight: {
        touch: "var(--touch-target-min)",
      },
      minWidth: {
        touch: "var(--touch-target-min)",
      },
    },
  },
  plugins: [],
} satisfies Config;
