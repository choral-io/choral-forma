import { build } from "esbuild";
import { rm } from "node:fs/promises";

await rm("dist/test", { force: true, recursive: true });

await build({
    bundle: true,
    entryPoints: ["src/test/suite/extension.integration.ts"],
    external: ["vscode", "mocha"],
    format: "cjs",
    outfile: "dist/test/extension.test.cjs",
    platform: "node",
    sourcemap: false,
    target: "node18",
});

await build({
    bundle: true,
    entryPoints: ["src/test/suite/untrusted.integration.ts"],
    external: ["vscode", "mocha"],
    format: "cjs",
    outfile: "dist/test/untrusted.test.cjs",
    platform: "node",
    sourcemap: false,
    target: "node18",
});

await build({
    bundle: true,
    entryPoints: ["src/test/installed-runner.ts"],
    external: ["vscode"],
    format: "cjs",
    outfile: "dist/test/installed-runner.cjs",
    platform: "node",
    sourcemap: false,
    target: "node18",
});
