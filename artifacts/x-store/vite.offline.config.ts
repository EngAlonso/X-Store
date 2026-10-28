import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { offlineLicensePublicKeyDefine } from "./vite-license-key";

const root = path.resolve(import.meta.dirname);

export default defineConfig(({ command }) => ({
  base: "./",
  plugins: [react()],
  define: offlineLicensePublicKeyDefine({ required: true }),
  resolve: {
    alias: {
      "@": path.resolve(root, "src"),
    },
    dedupe: ["react", "react-dom"],
  },
  root,
  build: {
    outDir: path.resolve(root, "dist/offline"),
    emptyOutDir: true,
    rollupOptions: {
      input: path.resolve(root, "offline.html"),
    },
  },
  server: {
    port: 4174,
    strictPort: true,
    host: "0.0.0.0",
    allowedHosts: true,
    ...(command === "serve"
      ? {
          headers: {
            "Content-Security-Policy":
              "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; connect-src 'self' ws://127.0.0.1:4174 ws://localhost:4174; font-src 'self' data:; object-src 'none'; base-uri 'self'; form-action 'self'",
          },
        }
      : {}),
  },
}));
