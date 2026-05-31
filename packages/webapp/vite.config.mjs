import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const formaRpcProxyTarget = process.env.FORMA_RPC_PROXY_TARGET;

export default defineConfig({
    base: "./",
    resolve: {
        alias: {
            "@": fileURLToPath(new URL("./src", import.meta.url)),
            "@choral-forma/shared": fileURLToPath(new URL("../shared/src/index.ts", import.meta.url)),
        },
    },
    server: formaRpcProxyTarget
        ? {
              proxy: {
                  "/rpc": {
                      changeOrigin: true,
                      target: formaRpcProxyTarget,
                  },
              },
          }
        : undefined,
    plugins: [tailwindcss(), react()],
});
