import { build, context } from "esbuild";

const extensionOptions = {
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

const previewOptions = {
    bundle: true,
    entryPoints: ["src/preview-entry.ts"],
    format: "iife",
    minify: process.argv.includes("--production"),
    outfile: "dist/markdown-preview.js",
    platform: "browser",
    sourcemap: false,
    target: "es2022",
};

if (process.argv.includes("--watch")) {
    const contexts = await Promise.all([context(extensionOptions), context(previewOptions)]);
    await Promise.all(contexts.map(async (buildContext) => await buildContext.watch()));
} else {
    await Promise.all([build(extensionOptions), build(previewOptions)]);
}
