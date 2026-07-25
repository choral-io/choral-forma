import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

import subsetFont from "subset-font";

const require = createRequire(import.meta.url);
const packageRoot = path.dirname(require.resolve("lucide-static/package.json"));
const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const outputPath = path.resolve(scriptDirectory, "../src/assets/lucide-link-icons.woff2");
const sourcePath = path.join(packageRoot, "font/lucide.woff2");
const codepointsPath = path.join(packageRoot, "font/codepoints.json");
const expectedCodepoints = {
    "external-link": 0xe0b9,
    "hash": 0xe0ef,
};

const codepoints = JSON.parse(await readFile(codepointsPath, "utf8"));
for (const [name, expectedCodepoint] of Object.entries(expectedCodepoints)) {
    if (codepoints[name] !== expectedCodepoint) {
        throw new Error(
            `Lucide changed the ${name} codepoint from U+${expectedCodepoint.toString(16).toUpperCase()} to U+${codepoints[
                name
            ]
                ?.toString(16)
                .toUpperCase()}. Update the CSS glyph mapping before regenerating the font.`,
        );
    }
}

const sourceFont = await readFile(sourcePath);
const subset = await subsetFont(
    sourceFont,
    Object.values(expectedCodepoints)
        .map((codepoint) => String.fromCodePoint(codepoint))
        .join(""),
    { targetFormat: "woff2" },
);

await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, subset);

console.log(`Generated ${path.relative(process.cwd(), outputPath)} (${subset.byteLength} bytes).`);
