import type { Config } from "tailwindcss";

const smartoutPreset = {
  content: [], // Users of preset will override this
  theme: {
    extend: {
      colors: {
        brand: {
          primary: "#3b82f6",
          secondary: "#10b981",
          accent: "#8b5cf6",
        },
        success: {
          500: "#22c55e",
        },
        warning: {
          500: "#eab308",
        },
        danger: {
          500: "#ef4444",
        },
        department: {
          kitchen: "#FF6B35",
          floor: "#2EC4B6",
          bar: "#9B5DE5",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
} satisfies Config;

export default smartoutPreset;
