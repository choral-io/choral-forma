// @vitest-environment jsdom

import { Marked } from "marked";
import { describe, expect, it, vi } from "vitest";

import { createMermaidRenderScope, mermaidPolicy, type MermaidRenderScope } from "@/lib/mermaid";

import { postProcessMarkdownHtml } from "./MarkdownReader";
import { createMarkedMermaid, mermaidSupport, sanitizeMermaidSvg } from "./markdown-mermaid";

const safeSvg = '<svg xmlns="http://www.w3.org/2000/svg"><text>Rendered</text></svg>';

describe("createMarkedMermaid", () => {
    it("renders a fully validated diagram into a semantic, theme-aware accessible figure", async () => {
        const html = postProcessMarkdownHtml(
            await render("```mermaid\ngraph LR\n  Start[Repository Markdown] --> Finish[Worker adapter]\n```"),
            [],
            "validation/markdown-rendering-showcase.md",
            [],
            false,
        );

        expect(html).toContain('class="mermaid-diagram"');
        expect(html).toContain('data-diagram-kind="flowchart"');
        expect(html).toContain("<figcaption");
        expect(html).toContain("Flowchart diagram");
        expect(html).toContain('aria-labelledby="forma-mermaid-test-scope-1-caption"');
        expect(html).toContain('aria-describedby="forma-mermaid-test-scope-1-description"');
        expect(html).toContain("Items: Repository Markdown, Worker adapter.");
        expect(html).toContain("Relationships: Start to Finish.");
        expect(html).toContain('aria-label="Interactive flowchart diagram"');
        expect(html).toContain("View Mermaid source");
        expect(html).toContain("Start[Repository Markdown] --&gt; Finish[Worker adapter]");
        expect(html).toContain('aria-hidden="true"');
        expect(html).toContain("--bg:var(--color-base-100)");
        expect(html).toContain("--fg:var(--color-base-content)");
        expect(html).toContain("--accent:var(--color-primary)");
    });

    it("keeps invalid, unsupported, timed-out, and over-budget diagrams as readable source", async () => {
        const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
        const invalid = await render("```mermaid\ngraph TD\n  A --> B trailing\n```");
        const mixed = await render("```mermaid\ngraph TD\n  A --> B\n  participant C\n```");
        const unsupported = await render('```mermaid\npie\n  title Pets\n  "Dogs" : 4\n```');
        const rejected = await render("```mermaid\ngraph TD\n  A --> B\n```", {
            renderDiagram: () => Promise.reject(new Error("timeout")),
        });

        for (const html of [invalid, mixed, unsupported, rejected]) {
            expect(html).toContain('<code class="language-mermaid">');
            expect(html).not.toContain("mermaid-diagram");
        }
        expect(rejected).toContain("A --&gt; B");
        warn.mockRestore();
    });

    it.each([
        ["click A https://evil.test", "click directive"],
        ["accTitle: Hidden title", "accessibility title"],
        ["accDescr: Hidden description", "accessibility description"],
        ["Note over A: Ignored", "unsupported note"],
    ])("fails closed on %s", async (trailing) => {
        const renderDiagram = vi.fn(() => Promise.resolve(safeSvg));
        const html = await render(`\`\`\`mermaid\nflowchart LR\nA --> B\n${trailing}\n\`\`\``, { renderDiagram });

        expect(renderDiagram).not.toHaveBeenCalled();
        expect(html).toContain('<code class="language-mermaid">');
        expect(html).toContain(trailing);
    });

    it("supports sequence notes because they are fully consumed by the declared subset", async () => {
        const html = await render("```mermaid\nsequenceDiagram\nA->>B: Hello\nNote right of B: Accessible source\n```");

        expect(html).toContain("Sequence diagram");
        expect(html).toContain("Note right of B: Accessible source");
    });

    it("escapes malicious source in the optional disclosure", async () => {
        const html = await render(
            "```mermaid\nflowchart LR\nA[&lt;/code&gt;&lt;img src=x onerror=alert(1)&gt;] --> B\n```",
        );
        const document = new DOMParser().parseFromString(html, "text/html");

        expect(document.querySelector("img")).toBeNull();
        expect(document.querySelector("[onerror]")).toBeNull();
        expect(html).toContain("&amp;lt;/code&amp;gt;");
    });

    it("does not change ordinary fenced code rendering", async () => {
        const html = await render("```ts\nconst answer = 42;\n```");

        expect(html).toContain('<code class="language-ts">');
        expect(html).toContain("const answer = 42;");
        expect(html).not.toContain("mermaid-diagram");
    });

    it("uses Forma semantic colors for light and dark theme resolution", async () => {
        const html = await render("```mermaid\nsequenceDiagram\n  Alice->>Bob: Hello\n```");

        expect(html).toContain("--bg:var(--color-base-100)");
        expect(html).toContain("--fg:var(--color-base-content)");
        expect(html).toContain("--accent:var(--color-primary)");
        expect(html).not.toContain("choral-light");
        expect(html).not.toContain("choral-dark");
    });

    it("publishes the reviewed structural, output, and aggregate policy", () => {
        expect(mermaidSupport.diagramTypes).toEqual(["flowchart", "state", "sequence", "class", "entity relationship"]);
        expect(mermaidSupport.policy).toEqual(mermaidPolicy);
        expect(mermaidPolicy.diagram.maxRelations).toBe(128);
        expect(mermaidPolicy.scope.maxDiagrams).toBe(8);
        expect(mermaidPolicy.output.maxBytes).toBe(512 * 1024);
    });

    it("shares aggregate limits across separate Marked readers", async () => {
        const scope = createMermaidRenderScope("shared");
        const renderDiagram = vi.fn(() => Promise.resolve(safeSvg));
        const markdown = "```mermaid\ngraph LR\nA --> B\n```";
        const readers = await Promise.all(
            Array.from({ length: mermaidPolicy.scope.maxDiagrams + 1 }, () =>
                render(markdown, { renderDiagram, scope }),
            ),
        );

        expect(renderDiagram).toHaveBeenCalledTimes(mermaidPolicy.scope.maxDiagrams);
        expect(readers.filter((html) => html.includes("mermaid-diagram"))).toHaveLength(
            mermaidPolicy.scope.maxDiagrams,
        );
        expect(
            readers.filter(
                (html) => !html.includes("mermaid-diagram") && html.includes('<code class="language-mermaid">'),
            ),
        ).toHaveLength(1);
        scope.dispose();
    });
});

describe("sanitizeMermaidSvg", () => {
    it("blocks remote resources, links, events, scripts, and injected CSS before final sanitization", () => {
        const malicious = [
            '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)" style="background:url(https://evil.test/a)">',
            '<STYLE>@import url("https://evil.test/font.css"); text { fill: red; }</STYLE>',
            '<defs><marker id="safe"><path d="M0 0"/></marker></defs>',
            '<path marker-end="url(#safe)" fill="url(https://evil.test/fill.svg)" onclick="alert(1)"/>',
            '<path stroke="u\\72l(https://evil.test/stroke.svg)"/>',
            '<a href="javascript:alert(1)"><text>Unsafe link</text></a>',
            '<image href="https://evil.test/tracker.svg"/>',
            "<foreignObject><div>Foreign HTML</div></foreignObject>",
            "<script>alert(1)</script>",
            "</svg>",
        ].join("");

        const normalized = sanitizeMermaidSvg(malicious);
        const finalHtml = postProcessMarkdownHtml(
            `<figure class="mermaid-diagram">${normalized}</figure>`,
            [],
            "guidelines/example.md",
            [],
            false,
        );

        expect(finalHtml).toContain('marker-end="url(#safe)"');
        expect(finalHtml).toContain("--bg:var(--color-base-100)");
        expect(finalHtml).not.toMatch(/https?:\/\/evil\.test/);
        expect(finalHtml).not.toContain("javascript:");
        expect(finalHtml).not.toContain("onclick");
        expect(finalHtml).not.toContain("onload");
        expect(finalHtml).not.toContain("@import");
        expect(finalHtml).not.toContain("<script");
        expect(finalHtml).not.toContain("<foreignObject");
        expect(finalHtml).not.toContain("<image");
    });

    it("rejects oversized SVG strings and element trees", () => {
        expect(() =>
            sanitizeMermaidSvg(
                `<svg xmlns="http://www.w3.org/2000/svg"><text>${"x".repeat(mermaidPolicy.output.maxBytes)}</text></svg>`,
            ),
        ).toThrow("output limit");
        expect(() =>
            sanitizeMermaidSvg(
                `<svg xmlns="http://www.w3.org/2000/svg">${"<path/>".repeat(mermaidPolicy.output.maxElements)}</svg>`,
            ),
        ).toThrow("element limit");
    });
});

interface RenderOptions {
    renderDiagram?: NonNullable<Parameters<typeof createMarkedMermaid>[0]["renderDiagram"]>;
    scope?: MermaidRenderScope;
}

async function render(markdown: string, { renderDiagram = () => Promise.resolve(safeSvg), scope }: RenderOptions = {}) {
    const activeScope = scope ?? createMermaidRenderScope("test-scope");
    const ownedScope = scope ? undefined : activeScope;
    const marked = new Marked({ gfm: true });
    marked.use(createMarkedMermaid({ renderDiagram, scope: activeScope }));
    try {
        return await Promise.resolve(marked.parse(markdown, { async: true }));
    } finally {
        ownedScope?.dispose();
    }
}
