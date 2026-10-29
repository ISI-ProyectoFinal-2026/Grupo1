import type { Config } from "tailwindcss";
import defaultTheme from "tailwindcss/defaultTheme";

// Los colores leen las custom properties de src/index.css (canales RGB) para
// que Tailwind pueda aplicar opacidad (`bg-ink/10`) sobre el mismo token.
const token = (name: string) => `rgb(var(--color-${name}) / <alpha-value>)`;

export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  // hover: solo con mouse; en touch el :hover queda "pegado" tras el tap.
  future: { hoverOnlyWhenSupported: true },
  theme: {
    extend: {
      colors: {
        ink: { DEFAULT: token("ink"), muted: token("ink-muted") },
        line: token("line"),
        surface: token("surface"),
        paper: token("paper"),
        signal: { DEFAULT: token("signal"), deep: token("signal-deep"), soft: token("signal-soft"), track: token("signal-track"), ink: token("signal-ink") },
        danger: { DEFAULT: token("danger"), soft: token("danger-soft") },
        success: { DEFAULT: token("success"), ink: token("success-ink"), soft: token("success-soft") },
        lost: { DEFAULT: token("lost"), soft: token("lost-soft") },
        found: { DEFAULT: token("found"), soft: token("found-soft") },
        caramel: { DEFAULT: token("caramel"), soft: token("caramel-soft") },
      },
      fontFamily: {
        display: ['"Atkinson Hyperlegible"', ...defaultTheme.fontFamily.sans],
        // letra de filete: wordmark y titulos de pagina
        filete: ['"Abril Fatface"', ...defaultTheme.fontFamily.serif],
        sans: ['"Atkinson Hyperlegible"', ...defaultTheme.fontFamily.sans],
      },
      fontSize: {
        // Escala tipografica: cuerpo 16px, titulos en la fuente display.
        "display-xl": ["2.875rem", { lineHeight: "1.05", letterSpacing: "0", fontWeight: "400" }],
        "display-lg": ["2.125rem", { lineHeight: "1.1", letterSpacing: "0", fontWeight: "400" }],
        "display-md": ["1.5rem", { lineHeight: "1.2", letterSpacing: "-0.01em", fontWeight: "700" }],
        "display-sm": ["1.125rem", { lineHeight: "1.3", letterSpacing: "0", fontWeight: "700" }],
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
        // sin sombra en reposo: las superficies se separan por borde y tono
        card: "0 0 #0000",
        lift: "0 16px 36px -12px rgb(74 40 24 / 0.28), 0 3px 8px rgb(74 40 24 / 0.08)",
        button: "0 0 #0000",
        sheet: "0 -10px 30px rgb(42 31 26 / 0.22)",
        pop: "0 16px 40px -8px rgb(74 40 24 / 0.26), 0 2px 6px rgb(74 40 24 / 0.08)",
      },
      // Curvas y duraciones: leen los tokens de src/index.css.
      transitionTimingFunction: {
        out: "var(--ease-out)",
        "in-out": "var(--ease-in-out)",
        drawer: "var(--ease-drawer)",
      },
      transitionDuration: {
        press: "var(--duration-press)",
        fast: "var(--duration-fast)",
        base: "var(--duration-base)",
      },
      keyframes: {
        "fade-in": { from: { opacity: "0" } },
        "rise-in": { from: { opacity: "0", transform: "translateY(8px)" } },
        "drop-in": { from: { opacity: "0", transform: "translateY(-4px)" } },
        "pop-in": { from: { opacity: "0", transform: "scale(0.95)" } },
        "sheet-in": { from: { opacity: "0", transform: "translateY(24px)" } },
      },
      animation: {
        fade: "fade-in var(--duration-base) var(--ease-out) both",
        rise: "rise-in 280ms var(--ease-out) both",
        drop: "drop-in var(--duration-fast) var(--ease-out) both",
        pop: "pop-in var(--duration-fast) var(--ease-out) both",
        sheet: "sheet-in 260ms var(--ease-drawer) both",
      },
    },
  },
  plugins: [],
} satisfies Config;
