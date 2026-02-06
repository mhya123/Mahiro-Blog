/** @type {import('tailwindcss').Config} */
import { addDynamicIconSelectors } from "@iconify/tailwind";
import typography from "@tailwindcss/typography";
import daisyUI from "daisyui";
import tailwindcssAnimate from "tailwindcss-animate";
import { SITE_THEME } from "./src/config";

export default {
  content: ["./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}"],
  theme: {
    extend: {
      colors: {
        "neu-base": "var(--neu-base)",
        "neu-text": "var(--neu-text)",
        "neu-accent": "var(--neu-accent)",
        "neu-border": "var(--neu-border)",
        "neu-btn-bg": "var(--neu-btn-bg)",
        "neu-btn-text": "var(--neu-btn-text)",
        "neu-text-muted": "var(--neu-text-muted)",
      },
      boxShadow: {
        "neu-out": "var(--shadow-neu-out)",
        "neu-in": "var(--shadow-neu-in)",
      },
      fontFamily: {
        sans: ['"M PLUS Rounded 1c"', '"Nunito"', '"Noto Sans SC"', "sans-serif"],
        banner: ['"ZCOOL KuaiLe"', "cursive"],
        mono: ['"JetBrains Mono"', "monospace"],
      },
    },
  },
  safelist: [
    "alert",
    "alert-info",
    "alert-success",
    "alert-warning",
    "alert-error",
  ],
  plugins: [daisyUI, typography, addDynamicIconSelectors(), tailwindcssAnimate],
  daisyui: {
    themes: true, // true: all themes | false: only light + dark | array: specific themes like this ["light", "dark", "cupcake"]
    darkTheme: SITE_THEME.dark, // name of one of the included themes for dark mode
    logs: false, // Shows info about daisyUI version and used config in the console when building your CSS
  },
};
