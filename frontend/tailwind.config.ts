import type { Config } from "tailwindcss";
import defaultTheme from "tailwindcss/defaultTheme";

// Los colores leen las custom properties de src/index.css (canales RGB) para
// que Tailwind pueda aplicar opacidad (`bg-ink/10`) sobre el mismo token.
const token = (name: string) => `rgb(var(--color-${name}) / <alpha-value>)`;

export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: { DEFAULT: token("ink"), muted: token("ink-muted") },
        line: token("line"),
        surface: token("surface"),
        paper: token("paper"),
        signal: { DEFAULT: token("signal"), deep: token("signal-deep") },
        danger: { DEFAULT: token("danger"), soft: token("danger-soft") },
        success: { DEFAULT: token("success"), ink: token("success-ink"), soft: token("success-soft") },
      },
      fontFamily: {
        display: ['"Bricolage Grotesque"', ...defaultTheme.fontFamily.sans],
        sans: ['"Atkinson Hyperlegible"', ...defaultTheme.fontFamily.sans],
      },
      fontSize: {
        // Escala tipografica: cuerpo 16px, titulos en la fuente display.
        "display-xl": ["2.75rem", { lineHeight: "1.02", letterSpacing: "-0.03em", fontWeight: "800" }],
        "display-lg": ["2rem", { lineHeight: "1.08", letterSpacing: "-0.025em", fontWeight: "800" }],
        "display-md": ["1.5rem", { lineHeight: "1.15", letterSpacing: "-0.02em", fontWeight: "700" }],
        "display-sm": ["1.125rem", { lineHeight: "1.25", letterSpacing: "-0.01em", fontWeight: "700" }],
      },
      borderRadius: {
        card: "16px",
        control: "12px",
      },
      maxWidth: {
        prose: "68ch",
      },
      spacing: {
        header: "var(--header-h)",
        tabbar: "var(--tabbar-h)",
        sidebar: "var(--sidebar-w)",
      },
      boxShadow: {
        sheet: "0 -8px 24px rgb(27 36 48 / 0.12)",
        pop: "0 12px 32px rgb(27 36 48 / 0.16)",
      },
    },
  },
  plugins: [],
} satisfies Config;
