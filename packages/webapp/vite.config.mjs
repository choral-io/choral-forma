import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

export default defineConfig(({ mode }) => {
    const formaRpcProxyTarget = process.env.FORMA_RPC_PROXY_TARGET;
    const workspaceClient = mode === "static" ? "static" : "rpc";

    return {
        base: "./",
        define: {
            __FORMA_WORKSPACE_CLIENT__: JSON.stringify(workspaceClient),
        },
        resolve: {
            alias: {
                "@": fileURLToPath(new URL("./src", import.meta.url)),
                "@choral-forma/graph-view/fixtures": fileURLToPath(
                    new URL("../graph-view/src/fixtures.ts", import.meta.url),
                ),
                "@choral-forma/graph-view/presentation": fileURLToPath(
                    new URL("../graph-view/src/presentation.ts", import.meta.url),
                ),
                "@choral-forma/graph-view/projection": fileURLToPath(
                    new URL("../graph-view/src/projection.ts", import.meta.url),
                ),
                "@choral-forma/graph-view": fileURLToPath(new URL("../graph-view/src/index.ts", import.meta.url)),
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
                      "/raw": {
                          changeOrigin: true,
                          target: formaRpcProxyTarget,
                      },
                  },
              }
            : undefined,
        plugins: [tailwindcss(), react()],
    };
});
