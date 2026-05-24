import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  resolve: {
    alias: {
      "@choral-forma/shared": fileURLToPath(new URL("../shared/src/index.ts", import.meta.url)),
    },
  },
  plugins: [react()],
});
