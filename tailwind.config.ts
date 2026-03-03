import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        serif: ["Merriweather", "Georgia", "Times New Roman", "serif"],
        sans: [
          "Source Sans 3",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "sans-serif",
        ],
        mono: [
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "Monaco",
          "Consolas",
          "monospace",
        ],
      },
      colors: {
        navy: {
          50: "#f4f5fa",
          100: "#e2e5f0",
          200: "#c7cdde",
          300: "#9aa5c0",
          400: "#6e7fa6",
          500: "#4d608d",
          600: "#364770",
          700: "#283756",
          800: "#1c2840",
          900: "#121b2d",
          950: "#0b111e",
        },
        forest: {
          50: "#f2f7f4",
          100: "#dce8e0",
          200: "#b5d1bd",
          300: "#7ab494",
          400: "#4d9670",
          500: "#347a55",
          600: "#266040",
          700: "#1d4a31",
          800: "#163724",
          900: "#0f2619",
          950: "#0a1a10",
        },
        gold: {
          50: "#fdf8eb",
          100: "#f9edcc",
          200: "#f2da99",
          300: "#ebc766",
          400: "#d4a537",
          500: "#c9a227",
          600: "#a07e1e",
          700: "#785e17",
          800: "#504010",
          900: "#28200a",
        },
      },
    },
  },
  plugins: [require("@tailwindcss/forms")],
};

export default config;
