import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        receita: "#3B6D11",
        "receita-soft": "#E8F1DD",
        despesa: "#A32D2D",
        "despesa-soft": "#F5DEDE",
        marca: {
          preto: "#000000",
          branco: "#FFFFFF",
          fundo: "#F5F5F5",
          texto: "#000000",
          "texto-suave": "#444444",
          borda: "#E5E5E5",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
