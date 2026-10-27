import type { Config } from "tailwindcss";
import { brandColors } from "./src/shared/brand/palette";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: brandColors,
        "baby-pink": {
          50: "#F8F4FC", 100: "#F1EAF8", 200: "#E8DEEE",
          300: "#CDBCE0", 400: "#A98BC5", 500: "#70508F",
          600: "#654681", 700: "#54366F", 800: "#46305B", 900: "#382C46",
        },
        "baby-blue": {
          50: "#eef6ff",
          100: "#dcecfd",
          200: "#c0dffc",
          300: "#93c9fb",
          400: "#60aef8",
          500: "#3b8ff3",
          600: "#2575e9",
          700: "#1f5fc6",
          800: "#1f519f",
          900: "#1e457f",
        },
        mint: {
          50: "#effcf6",
          100: "#daf7ec",
          200: "#b8eed9",
          300: "#87e0bf",
          400: "#52cda1",
          500: "#2db886",
          600: "#1e936c",
          700: "#197558",
          800: "#175d48",
          900: "#154c3c",
        },
        cream: brandColors.cream,
      },
      fontFamily: { sans: ["Nunito Sans", "system-ui", "sans-serif"], display: ["Nunito Sans", "system-ui", "sans-serif"] },
    },
  },
  plugins: [],
};
export default config;
