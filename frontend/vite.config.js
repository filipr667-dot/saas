import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "REACT_APP_");

  return {
    plugins: [react()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    define: {
      "process.env.REACT_APP_BACKEND_URL": JSON.stringify(
        env.REACT_APP_BACKEND_URL || "http://localhost:8001"
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
