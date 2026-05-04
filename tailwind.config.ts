import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        brand: { DEFAULT: "#0F766E", dark: "#0D5F58" },
        accent: { DEFAULT: "#F59E0B", dark: "#D97706" },
        bg: "#F8FAFC",
      },
      fontFamily: {
        sans: [
          "var(--font-inter)",
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "sans-serif",
        ],
      },
      keyframes: {
        // Slow drift with a small rotation — used by FloatingSportsBg.
        // Three speeds so the icons don't move in sync.
        "float-slow": {
          "0%, 100%": { transform: "translate(0, 0) rotate(0deg)" },
          "50%": { transform: "translate(8px, -16px) rotate(6deg)" },
        },
        "float-medium": {
          "0%, 100%": { transform: "translate(0, 0) rotate(0deg)" },
          "50%": { transform: "translate(-12px, -10px) rotate(-8deg)" },
        },
        "float-fast": {
          "0%, 100%": { transform: "translate(0, 0) rotate(0deg)" },
          "50%": { transform: "translate(10px, 10px) rotate(10deg)" },
        },
        // Reveal-on-scroll animation. Driven by adding the
        // `data-revealed=true` attribute via IntersectionObserver.
        "reveal-up": {
          from: { opacity: "0", transform: "translateY(16px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "float-slow": "float-slow 9s ease-in-out infinite",
        "float-medium": "float-medium 7s ease-in-out infinite",
        "float-fast": "float-fast 6s ease-in-out infinite",
        "reveal-up": "reveal-up 600ms ease-out both",
      },
    },
  },
  plugins: [],
};

export default config;
