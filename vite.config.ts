import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

export default defineConfig(({ mode }) => ({
  plugins: [
    // 🔒 Force production JSX runtime (NO _jsxDEV)
    react({
      development: false,
    }),

    // Enable component tagger ONLY in dev
    mode === "development" && componentTagger(),
  ].filter(Boolean),

  server: {
    host: "::", // IPv4 + IPv6
    port: 8080,
    allowedHosts: [
      "qrdfp-x.onrender.com",
    ],
    hmr: {
      overlay: false,
    },
  },

  preview: {
    host: true, // REQUIRED for Render
    port: 4173,
  },

  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },

  build: {
    sourcemap: false, // production safe
  },
}));