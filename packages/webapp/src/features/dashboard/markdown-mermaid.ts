import type { MarkedExtension, Tokens } from "marked";

// Forma intentionally supports only the beautiful-mermaid syntax exercised here:
// directional flowcharts, stateDiagram-v2, sequenceDiagram, classDiagram, and
// erDiagram. Init directives and every other Mermaid family remain source code.
export const mermaidSupport = {
    diagramTypes: ["flowchart", "state", "sequence", "class", "entity relationship"] as const,
    maxDiagramsPerDocument: 20,
    maxSourceLength: 50_000,
};

type MermaidDiagramKind = (typeof mermaidSupport.diagramTypes)[number];

const removableElements = new Set([
    "foreignobject",
    "iframe",
    "object",
    "embed",
    "script",
    "style",
    "image",
    "audio",
    "video",
]);
const localUrlAttributes = new Set([
    "clip-path",
    "fill",
    "filter",
    "marker-end",
    "marker-mid",
    "marker-start",
    "mask",
    "stroke",
]);
const localUrlReference = /^url\(\s*(["']?)#[A-Za-z_][\w:.-]*\1\s*\)$/i;
const trustedThemeStyle = [
    "--bg:var(--color-base-100)",
    "--fg:var(--color-base-content)",
    "--accent:var(--color-primary)",
    "--surface:var(--color-base-200)",
    "--border:var(--color-base-300)",
    "--_text:var(--fg)",
    "--_text-sec:color-mix(in srgb,var(--fg) 60%,var(--bg))",
    "--_text-muted:color-mix(in srgb,var(--fg) 40%,var(--bg))",
    "--_text-faint:color-mix(in srgb,var(--fg) 25%,var(--bg))",
    "--_line:color-mix(in srgb,var(--fg) 50%,var(--bg))",
    "--_arrow:var(--accent)",
    "--_node-fill:var(--surface)",
    "--_node-stroke:var(--border)",
    "--_group-fill:var(--bg)",
    "--_group-hdr:color-mix(in srgb,var(--fg) 5%,var(--bg))",
    "--_inner-stroke:color-mix(in srgb,var(--fg) 12%,var(--bg))",
    "--_key-badge:color-mix(in srgb,var(--fg) 10%,var(--bg))",
    "font-family:ui-sans-serif,system-ui,sans-serif",
].join(";");

export function createMarkedMermaid(renderDiagram = renderMermaid): MarkedExtension {
    let renderedDiagrams = 0;

    return {
        async walkTokens(token) {
            if (token.type !== "code" || typeof token.text !== "string") {
                return;
            }

            const codeToken = token as Tokens.Code;
            if (codeToken.lang?.trim().toLowerCase() !== "mermaid") {
                return;
            }

            const kind = supportedDiagramKind(codeToken.text);
            if (
                !kind ||
                codeToken.text.length > mermaidSupport.maxSourceLength ||
                renderedDiagrams >= mermaidSupport.maxDiagramsPerDocument
            ) {
                return;
            }

            renderedDiagrams += 1;
            try {
                const svg = await renderDiagram(codeToken.text);
                token.type = "html";

                const htmlToken = token as Tokens.HTML;
                htmlToken.raw = codeToken.raw;
                htmlToken.pre = false;
                htmlToken.block = true;
                htmlToken.text = [
                    `<figure aria-label="Mermaid ${kind} diagram" class="mermaid-diagram" data-diagram-kind="${kind}" tabindex="0">`,
                    svg,
                    "</figure>",
                ].join("");
            } catch (error: unknown) {
                console.warn("Mermaid diagram rendering failed; rendering source code.", error);
            }
        },
    };
}

export function sanitizeMermaidSvg(svgSource: string) {
    const parsed = new DOMParser().parseFromString(svgSource, "image/svg+xml");
    const svg = parsed.documentElement;
    if (svg.localName !== "svg" || svg.namespaceURI !== "http://www.w3.org/2000/svg") {
        throw new Error("Mermaid renderer did not return an SVG document.");
    }

    for (const element of Array.from(svg.querySelectorAll("*"))) {
        if (removableElements.has(element.localName.toLowerCase())) {
            element.remove();
        }
    }

    for (const element of [svg, ...Array.from(svg.querySelectorAll("*"))]) {
        for (const attribute of Array.from(element.attributes)) {
            const name = attribute.name.toLowerCase();
            const value = attribute.value.trim();

            if (
                name.startsWith("on") ||
                name === "href" ||
                name === "xlink:href" ||
                name === "src" ||
                name === "style"
            ) {
                element.removeAttribute(attribute.name);
                continue;
            }

            if (
                (localUrlAttributes.has(name) && value.includes("\\")) ||
                (/url\s*\(/i.test(value) && !localUrlReference.test(value))
            ) {
                element.removeAttribute(attribute.name);
            }
        }
    }

    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");
    svg.setAttribute("style", trustedThemeStyle);
    svg.setAttribute("xmlns", "http://www.w3.org/2000/svg");

    for (const monoText of svg.querySelectorAll("text.mono")) {
        monoText.setAttribute("font-family", "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace");
    }

    return svg.outerHTML;
}

function supportedDiagramKind(source: string): MermaidDiagramKind | undefined {
    const lines = source.split(/\r?\n/).map((line) => line.trim());
    if (lines.some((line) => line.startsWith("%%{"))) {
        return undefined;
    }

    const firstLine = lines.find((line) => line && !line.startsWith("%%")) ?? "";
    if (/^(?:flowchart|graph)\s+(?:TB|TD|BT|LR|RL)\b/i.test(firstLine)) {
        return "flowchart";
    }
    if (/^stateDiagram-v2\b/i.test(firstLine)) {
        return "state";
    }
    if (/^sequenceDiagram\b/i.test(firstLine)) {
        return "sequence";
    }
    if (/^classDiagram\b/i.test(firstLine)) {
        return "class";
    }
    if (/^erDiagram\b/i.test(firstLine)) {
        return "entity relationship";
    }
    return undefined;
}

async function renderMermaid(source: string) {
    const { renderMermaidSVGAsync } = await import("beautiful-mermaid");
    const svg = await renderMermaidSVGAsync(source, {
        accent: "var(--color-primary)",
        bg: "var(--color-base-100)",
        border: "var(--color-base-300)",
        fg: "var(--color-base-content)",
        font: "system-ui",
        surface: "var(--color-base-200)",
        transparent: true,
    });
    return sanitizeMermaidSvg(svg);
}
