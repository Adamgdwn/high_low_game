import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        neon: {
          cyan: "#62f3ff",
          pink: "#ff4fd8",
          lime: "#b7ff4a",
          gold: "#ffd666",
          night: "#090b15"
        }
      },
      boxShadow: {
        neon: "0 0 0.7rem rgba(98,243,255,.45), 0 0 2rem rgba(98,243,255,.15)",
        pink: "0 0 0.7rem rgba(255,79,216,.4), 0 0 2rem rgba(255,79,216,.18)"
      }
    }
  },
  plugins: []
};

export default config;
