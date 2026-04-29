import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// Use relative asset paths so the built bundle works whether it's served
// at the root (Pi prod / dev) or under a dynamic sub-path (HA ingress).
export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: "./",
  server: {
    host: "0.0.0.0",
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:8000",
        changeOrigin: true,
      },
    },
  },
});
