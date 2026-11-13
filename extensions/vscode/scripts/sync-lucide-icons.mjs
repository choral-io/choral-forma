import { mkdir, readFile, readdir, unlink, writeFile } from "node:fs/promises";

const iconIds = JSON.parse(
    await readFile(new URL("../../../crates/forma-core/src/display-icon-registry.json", import.meta.url), "utf8"),
);
const themes = {
    light: "#424242",
    dark: "#C5C5C5",
};
const checkOnly = process.argv.includes("--check");

for (const [theme, stroke] of Object.entries(themes)) {
    const directory = new URL(`../media/icons/lucide/${theme}/`, import.meta.url);
    await mkdir(directory, { recursive: true });
    const expected = new Set(iconIds.map((id) => `${id}.svg`));
    for (const file of await readdir(directory)) {
        if (!file.endsWith(".svg") || expected.has(file)) continue;
        if (checkOnly) throw new Error(`Unexpected generated Lucide asset: ${theme}/${file}`);
        await unlink(new URL(file, directory));
    }
    for (const icon of iconIds) {
        const iconData = await loadIconData(icon);
        const target = new URL(`${icon}.svg`, directory);
        const expectedSource = serializeIcon(iconData.node, stroke);
        if (checkOnly) {
            const actualSource = await readFile(target, "utf8");
            if (actualSource !== expectedSource)
                throw new Error(`Generated Lucide asset is stale: ${theme}/${icon}.svg`);
        } else {
            await writeFile(target, expectedSource, "utf8");
        }
    }
}

async function loadIconData(icon) {
    const specifier = `lucide-react/dist/esm/icons/${icon}.mjs`;
    const { __iconData } = await import(specifier);
    // lucide-react exposes the node array under `__iconData.node`; it was a bare
    // `__iconNode` export before v1.45.
    if (__iconData?.node) return __iconData;
    // A renamed icon keeps its previous id as a module that re-exports only the
    // default component, so the geometry has to be read from the module it names.
    const source = await readFile(new URL(import.meta.resolve(specifier)), "utf8");
    const renamed = /export \{ default \} from '\.\/(?<id>[a-z0-9-]+)\.mjs';/u.exec(source)?.groups?.id;
    const target = renamed ? await import(`lucide-react/dist/esm/icons/${renamed}.mjs`) : undefined;
    // Fail with the shape named, because the symptom of an unexpected shape is
    // an unhelpful TypeError further down.
    if (!target?.__iconData?.node) throw new Error(`Unsupported lucide-react icon module shape: ${icon}`);
    return target.__iconData;
}

function serializeIcon(nodes, stroke) {
    const elements = nodes
        .map(([tag, attributes]) => {
            const serialized = Object.entries(attributes)
                .filter(([name]) => name !== "key")
                .map(([name, value]) => `${camelToKebab(name)}="${escapeXml(String(value))}"`)
                .join(" ");
            return `  <${tag}${serialized ? ` ${serialized}` : ""} />`;
        })
        .join("\n");
    return `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="${stroke}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">\n${elements}\n</svg>\n`;
}

function camelToKebab(value) {
    return value.replace(/[A-Z]/gu, (letter) => `-${letter.toLowerCase()}`);
}

function escapeXml(value) {
    return value.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}
