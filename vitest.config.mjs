import { fileURLToPath } from "node:url";
import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        exclude: [...configDefaults.exclude, "**/.worktrees/**"],
    },
    resolve: {
        alias: {
            "@": fileURLToPath(new URL("./packages/webapp/src", import.meta.url)),
            "@choral-forma/graph-view/fixtures": fileURLToPath(
                new URL("./packages/graph-view/src/fixtures.ts", import.meta.url),
            ),
            "@choral-forma/graph-view/presentation": fileURLToPath(
                new URL("./packages/graph-view/src/presentation.ts", import.meta.url),
            ),
            "@choral-forma/graph-view/projection": fileURLToPath(
                new URL("./packages/graph-view/src/projection.ts", import.meta.url),
            ),
            "@choral-forma/graph-view": fileURLToPath(new URL("./packages/graph-view/src/index.ts", import.meta.url)),
            "@choral-forma/shared": fileURLToPath(new URL("./packages/shared/src/index.ts", import.meta.url)),
        },
    },
});
