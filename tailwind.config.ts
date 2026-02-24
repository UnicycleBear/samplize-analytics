import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["ui-monospace", "monospace"],
      },
      colors: {
        // Dashboard palette: navy/gray with teal accents
        analytics: {
          background: "#F0F2F5",
          surface: "#FFFFFF",
          "navy-primary": "#0F2040",
          "navy-secondary": "#1A3358",
          "navy-700": "#0d1a2d",
          "teal-accent": "#00897B",
          "teal-light": "#4DB6AC",
          "gray-text": "#4A5568",
          "border-light": "#E2E8F0",
          "positive": "#38A169",
          "negative": "#E53E3E",
          "grid": "#EDF2F7",
          "skeleton": "#E2E8F0",
          "skeleton-highlight": "#EDF2F7",
          "table-stripe": "#F7FAFC",
          "tooltip-bg": "#0F2040",
        },
      },
      boxShadow: {
        "card": "0 1px 3px 0 rgb(0 0 0 / 0.06), 0 1px 2px -1px rgb(0 0 0 / 0.06)",
      },
    },
  },
  plugins: [],
};
export default config;
