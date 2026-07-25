import { postProcessMarkdownHtml } from "@/features/dashboard/MarkdownReader";
import { sanitizeMermaidSvg } from "@/features/dashboard/markdown-mermaid";

import { MermaidRendererController } from "./controller";
import { validateMermaidSource, type ValidatedMermaidDiagram } from "./policy";

interface UpgradeGateResult {
    elapsedMs?: number;
    error?: string;
    frames?: number;
    maxFrameGapMs?: number;
    ok: boolean;
    sanitizedBytes?: number;
}

declare global {
    interface Window {
        __formaMermaidUpgradeGateResult?: UpgradeGateResult;
    }
}

const canonicalSource = "flowchart LR\nSource[Markdown] --> Output[Sanitized SVG]";
const responsiveSource = `flowchart LR
${Array.from({ length: 11 }, (_, index) => `A${String(index)}`).join(" & ")} --> ${Array.from(
    { length: 11 },
    (_, index) => `B${String(index)}`,
).join(" & ")}`;
const theme = {
    accent: "var(--color-primary)",
    bg: "var(--color-base-100)",
    border: "var(--color-base-300)",
    fg: "var(--color-base-content)",
    font: "system-ui",
    surface: "var(--color-base-200)",
    transparent: true,
};

void runUpgradeGate()
    .then((result) => {
        window.__formaMermaidUpgradeGateResult = { ok: true, ...result };
    })
    .catch((error: unknown) => {
        window.__formaMermaidUpgradeGateResult = {
            error: error instanceof Error ? `${error.name}: ${error.message}` : String(error),
            ok: false,
        };
    });

async function runUpgradeGate(): Promise<Omit<UpgradeGateResult, "ok">> {
    const controller = new MermaidRendererController();
    try {
        const canonical = validated(canonicalSource);
        const abortController = new AbortController();
        const aborted = controller.render(canonical, { signal: abortController.signal, theme });
        abortController.abort();
        await expectAbort(aborted);

        const rawCanonicalSvg = await controller.render(canonical, { theme });
        const sanitizedSvg = sanitizeMermaidSvg(rawCanonicalSvg);
        const finalHtml = postProcessMarkdownHtml(
            `<figure class="mermaid-diagram">${sanitizedSvg}</figure>`,
            [],
            "validation/mermaid-worker-upgrade.md",
            [],
            false,
        );
        assertSanitizedSvg(finalHtml);

        const responsive = await renderWithFrameProbe(controller, validated(responsiveSource));
        return {
            ...responsive,
            sanitizedBytes: new TextEncoder().encode(finalHtml).byteLength,
        };
    } finally {
        controller.dispose();
    }
}

async function expectAbort(render: Promise<string>) {
    try {
        await render;
    } catch (error: unknown) {
        if (error instanceof DOMException && error.name === "AbortError") {
            return;
        }
        throw error;
    }
    throw new Error("The active Worker render did not abort.");
}

async function renderWithFrameProbe(controller: MermaidRendererController, diagram: ValidatedMermaidDiagram) {
    let active = true;
    let frames = 0;
    let lastFrame = performance.now();
    let maxFrameGapMs = 0;
    const tick = (timestamp: number) => {
        if (!active) {
            return;
        }
        frames += 1;
        maxFrameGapMs = Math.max(maxFrameGapMs, timestamp - lastFrame);
        lastFrame = timestamp;
        requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);

    const startedAt = performance.now();
    const svg = await controller.render(diagram, { theme });
    const elapsedMs = performance.now() - startedAt;
    active = false;

    if (!svg.startsWith("<svg")) {
        throw new Error("The admitted responsiveness probe did not return SVG.");
    }
    if (elapsedMs >= 80 && (frames < 2 || maxFrameGapMs >= elapsedMs * 0.8)) {
        throw new Error(
            `Main-thread scheduling stalled during Worker render (${String(frames)} frames, ${maxFrameGapMs.toFixed(1)} ms max gap over ${elapsedMs.toFixed(1)} ms).`,
        );
    }

    return {
        elapsedMs: round(elapsedMs),
        frames,
        maxFrameGapMs: round(maxFrameGapMs),
    };
}

function assertSanitizedSvg(html: string) {
    const document = new DOMParser().parseFromString(html, "text/html");
    const svg = document.querySelector(".mermaid-diagram > svg");
    if (svg?.getAttribute("aria-hidden") !== "true") {
        throw new Error("The canonical Worker output did not pass through the SVG sanitization path.");
    }
    if (
        svg.querySelector("style, script, foreignObject, image, [href], [xlink\\:href], [src], [onload], [onclick]") ||
        svg.querySelector("[style]")
    ) {
        throw new Error("Sanitized Worker output retained a forbidden element or attribute.");
    }
}

function validated(source: string) {
    const result = validateMermaidSource(source);
    if (!result.ok) {
        throw new Error(result.diagnostic.message);
    }
    return result.diagram;
}

function round(value: number) {
    return Math.round(value * 10) / 10;
}
