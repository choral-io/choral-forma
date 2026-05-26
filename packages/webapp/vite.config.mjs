import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

export default defineConfig({
    base: "./",
    resolve: {
        alias: {
            "@": fileURLToPath(new URL("./src", import.meta.url)),
            "@choral-forma/shared": fileURLToPath(new URL("../shared/src/index.ts", import.meta.url)),
        },
    },
    plugins: [tailwindcss(), react()],
});
