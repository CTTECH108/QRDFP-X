import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { componentTagger } from "lovable-tagger";

export default defineConfig(({ mode }) => ({
  plugins: [
    react(), // ✅ Babel-based JSX (NO _jsxDEV issues)
    mode === "development" && componentTagger(),
  ].filter(Boolean),

  server: {
    host: "::",
    port: 8080,
    allowedHosts: ["qrdfp-x.onrender.com"],
    hmr: {
      overlay: false,
    },
  },

  preview: {
    host: true,
    port: 4173,
  },

  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
