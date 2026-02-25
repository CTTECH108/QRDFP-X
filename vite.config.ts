import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

export default defineConfig(({ mode }) => ({
  server: {
    host: "::", // allow IPv4 + IPv6
    port: 8080,
    allowedHosts: [
      "qrdfp-x.onrender.com" // ✅ FIX for your error
    ],
    hmr: {
      overlay: false,
    },
  },

  preview: {
    host: true,   // ✅ REQUIRED for Render
    port: 4173,
  },

  plugins: [
    react(),
    mode === "development" && componentTagger(),
  ].filter(Boolean),

  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
