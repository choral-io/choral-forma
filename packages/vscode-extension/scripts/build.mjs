import { build, context } from "esbuild";

const options = {
    bundle: true,
    entryPoints: ["src/extension.ts"],
    external: ["vscode"],
    format: "cjs",
    minify: process.argv.includes("--production"),
    outfile: "dist/extension.cjs",
    platform: "node",
    sourcemap: false,
    target: "node18",
};

if (process.argv.includes("--watch")) {
    const buildContext = await context(options);
    await buildContext.watch();
} else {
    await build(options);
}
