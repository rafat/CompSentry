import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        monad: {
          50: "#f5f3ff",
          500: "#836ef9",
          600: "#7056f7",
          700: "#5b37f4",
          900: "#200052",
        },
        cyber: {
          bg: "#080b11",
          card: "#0d131f",
          border: "#1b253b",
          highlight: "#2a3b5c",
        }
      },
      fontFamily: {
        mono: ["var(--font-mono)", "ui-monospace", "SFMono-Regular", "Menlo", "Monaco", "Consolas", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
