import type { MarkedExtension, Tokens } from "marked";

import {
    describeMermaidDiagram,
    mermaidDiagramKinds,
    mermaidPolicy,
    MermaidRendererController,
    validateMermaidSource,
    type MermaidRenderScope,
    type ValidatedMermaidDiagram,
} from "@/lib/mermaid";

export const mermaidSupport = {
    diagramTypes: mermaidDiagramKinds,
    policy: mermaidPolicy,
};

export interface MarkedMermaidOptions {
    renderDiagram?: (diagram: ValidatedMermaidDiagram, signal: AbortSignal) => Promise<string>;
    scope: MermaidRenderScope;
    signal?: AbortSignal;
}

const renderer = new MermaidRendererController();
const textEncoder = new TextEncoder();
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

export function createMarkedMermaid({
    renderDiagram = renderWithWorker,
    scope,
    signal,
}: MarkedMermaidOptions): MarkedExtension {
    return {
        async walkTokens(token) {
            if (token.type !== "code" || typeof token.text !== "string") {
                return;
            }

            const codeToken = token as Tokens.Code;
            if (codeToken.lang?.trim().toLowerCase() !== "mermaid") {
                return;
            }

            const validation = validateMermaidSource(codeToken.text);
            if (!validation.ok) {
                return;
            }
            const reservation = scope.reserve(validation.diagram);
            if (!reservation) {
                return;
            }

            const linkedSignal = linkAbortSignals(signal, scope.signal);
            try {
                const rawSvg = await renderDiagram(validation.diagram, linkedSignal.signal);
                const svg = sanitizeMermaidSvg(rawSvg);
                const outputBytes = textEncoder.encode(svg).byteLength;
                if (!scope.acceptOutput(reservation, outputBytes)) {
                    return;
                }

                token.type = "html";
                const htmlToken = token as Tokens.HTML;
                htmlToken.raw = codeToken.raw;
                htmlToken.pre = false;
                htmlToken.block = true;
                htmlToken.text = accessibleDiagramHtml(validation.diagram, reservation.diagramId, svg);
            } catch (error: unknown) {
                if (!(error instanceof DOMException && error.name === "AbortError")) {
                    console.warn("Mermaid diagram rendering failed; rendering source code.", error);
                }
            } finally {
                linkedSignal.dispose();
            }
        },
    };
}

export function sanitizeMermaidSvg(svgSource: string) {
    if (textEncoder.encode(svgSource).byteLength > mermaidPolicy.output.maxBytes) {
        throw new Error("Mermaid SVG exceeds the client output limit.");
    }

    const parsed = new DOMParser().parseFromString(svgSource, "image/svg+xml");
    const svg = parsed.documentElement;
    if (svg.localName !== "svg" || svg.namespaceURI !== "http://www.w3.org/2000/svg") {
        throw new Error("Mermaid renderer did not return an SVG document.");
    }
    if (svg.querySelectorAll("*").length + 1 > mermaidPolicy.output.maxElements) {
        throw new Error("Mermaid SVG exceeds the element limit.");
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

function accessibleDiagramHtml(diagram: ValidatedMermaidDiagram, diagramId: string, svg: string) {
    const captionId = `${diagramId}-caption`;
    const descriptionId = `${diagramId}-description`;
    const caption = diagramCaption(diagram);
    return [
        `<figure aria-describedby="${descriptionId}" aria-labelledby="${captionId}" class="mermaid-diagram" data-diagram-kind="${escapeHtmlAttribute(diagram.model.kind)}">`,
        `<figcaption class="mermaid-diagram-caption" id="${captionId}"><span class="mermaid-diagram-caption-label">${caption}</span></figcaption>`,
        `<p class="sr-only" id="${descriptionId}">${escapeHtml(describeMermaidDiagram(diagram))}</p>`,
        `<div aria-label="Interactive ${caption.toLowerCase()}" class="mermaid-diagram-viewport" id="${diagramId}-viewport" role="region" tabindex="0">${svg}</div>`,
        '<details class="collapse collapse-arrow mermaid-diagram-source">',
        '<summary class="collapse-title">View Mermaid source</summary>',
        `<div class="collapse-content"><pre aria-label="Mermaid source for ${escapeHtmlAttribute(caption)}" role="region" tabindex="0"><code class="language-mermaid">${escapeHtml(diagram.source)}</code></pre></div>`,
        "</details>",
        "</figure>",
    ].join("");
}

function diagramCaption(diagram: ValidatedMermaidDiagram) {
    switch (diagram.model.kind) {
        case "flowchart":
            return "Flowchart diagram";
        case "state":
            return "State diagram";
        case "sequence":
            return "Sequence diagram";
        case "class":
            return "Class diagram";
        case "entity relationship":
            return "Entity relationship diagram";
    }
}

function renderWithWorker(diagram: ValidatedMermaidDiagram, signal: AbortSignal) {
    return renderer.render(diagram, {
        signal,
        theme: {
            accent: "var(--color-primary)",
            bg: "var(--color-base-100)",
            border: "var(--color-base-300)",
            fg: "var(--color-base-content)",
            font: "system-ui",
            surface: "var(--color-base-200)",
            transparent: true,
        },
    });
}

function linkAbortSignals(...sources: (AbortSignal | undefined)[]) {
    const controller = new AbortController();
    const activeSources = sources.filter((source): source is AbortSignal => Boolean(source));
    const abort = () => {
        controller.abort();
    };
    for (const source of activeSources) {
        if (source.aborted) {
            controller.abort();
            break;
        }
        source.addEventListener("abort", abort, { once: true });
    }
    return {
        dispose() {
            for (const source of activeSources) {
                source.removeEventListener("abort", abort);
            }
        },
        signal: controller.signal,
    };
}

function escapeHtml(value: string) {
    return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

function escapeHtmlAttribute(value: string) {
    return escapeHtml(value).replaceAll("'", "&#39;");
}
