import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::", // allow IPv4 + IPv6
    port: 8080,
    allowedHosts: [
      "qrdfp-x.onrender.com", // ✅ FIX: allow Render domain
    ],
    hmr: {
      overlay: false,
    },
  },

  // Required for production preview (Render)
  preview: {
    host: true,
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
