import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig(({ mode }) => {
  return {
    plugins: [react({ include: /\.(jsx|js)$/ })],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    define: {
      __BACKEND_URL__: JSON.stringify(process.env.VITE_BACKEND_URL || "http://localhost:8001"),
    },
    build: {
      outDir: "build",
    },
    server: {
      port: 3000,
    },
  };
});
