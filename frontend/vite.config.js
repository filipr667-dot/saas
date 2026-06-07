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
      "process.env.REACT_APP_BACKEND_URL": JSON.stringify(
        process.env.REACT_APP_BACKEND_URL || "http://localhost:8001"
      ),
      "process.env.NODE_ENV": JSON.stringify(mode),
    },
    build: {
      outDir: "build",
    },
    server: {
      port: 3000,
    },
  };
});
