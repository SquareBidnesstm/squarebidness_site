import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx}",
    "./src/components/**/*.{js,ts,jsx,tsx}",
    "./src/lib/**/*.{js,ts,jsx,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          bg: "#0a0a0a",
          card: "#111111",
          line: "#232323",
          gold: "#d4af37",
          muted: "#a3a3a3"
        }
      }
    }
  },
  plugins: []
};

export default config;
