import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
    resolve: {
        alias: {
            "@": fileURLToPath(new URL("./packages/webapp/src", import.meta.url)),
            "@choral-forma/graph-view": fileURLToPath(new URL("./packages/graph-view/src/index.ts", import.meta.url)),
            "@choral-forma/shared": fileURLToPath(new URL("./packages/shared/src/index.ts", import.meta.url)),
        },
    },
});
