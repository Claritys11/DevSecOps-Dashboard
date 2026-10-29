import type { Config } from "tailwindcss";

const token = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

const config: Config = {
  darkMode: ["class"],
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: token("bg"),
        surface: token("surface"),
        raised: token("raised"),
        line: token("line"),
        fg: token("fg"),
        muted: token("muted"),
        accent: { DEFAULT: token("accent"), fg: token("accent-fg") },
        ok: token("ok"),
        warn: token("warn"),
        crit: token("crit"),
        idle: token("idle")
      },
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "SFMono-Regular", "monospace"]
      },
      fontSize: {
        // Modular scale (1.25) anchored at 14px UI text.
        "2xs": ["0.6875rem", { lineHeight: "1rem" }],
        xs: ["0.75rem", { lineHeight: "1.125rem" }],
        sm: ["0.875rem", { lineHeight: "1.375rem" }],
        base: ["1rem", { lineHeight: "1.5rem" }],
        lg: ["1.125rem", { lineHeight: "1.625rem" }],
        xl: ["1.375rem", { lineHeight: "1.875rem" }],
        "2xl": ["1.75rem", { lineHeight: "2.25rem", letterSpacing: "-0.01em" }],
        "3xl": ["2.25rem", { lineHeight: "2.625rem", letterSpacing: "-0.02em" }]
      },
      borderRadius: { DEFAULT: "6px", md: "8px", lg: "10px" }
    }
  },
  plugins: []
};

export default config;
