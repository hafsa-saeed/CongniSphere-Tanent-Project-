import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    // Allows *.localhost subdomains (acme.localhost:3000) to hit this dev server
    host: true,
  },
});
