export const mermaidGeometryChecks = [
    "ancestor edges meet their borders and avoid unrelated nodes",
    "decision self-loop meets the diamond outline",
    "multiple self-loop labels stay separate and inside the group",
    "subgraph self-loop preserves the original source",
];

/** Serialized into playwright-cli and run against both Markdown readers. */
export async function markdownMermaidGeometry(page, options) {
    const results = [];
    const failures = [];
    const browser = page.context().browser();
    for (const host of options.hosts) {
        const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
        try {
            const current = await context.newPage();
            await current.goto(`${host.origin}${host.root}/pages/notes/mermaid-geometry/`);
            const reader = current.locator(
                '[data-enhancement-ready] [data-reader="markdown"]:not([data-reader-loading])',
            );
            await reader.getByRole("heading", { name: "Subgraph self-loop", exact: true }).waitFor();
            const checks = await reader.evaluate((reader) => {
                const shape = (id) =>
                    reader.querySelector(`:is(.pele-node, .pele-cluster)[data-id="${id}"] > :is(rect, polygon)`);
                const edge = (from, to) => reader.querySelector(`.pele-edge[data-id="L_${from}_${to}_0"]`);
                const point = (path, distance = 0) =>
                    path.getPointAtLength(distance).matrixTransform(path.getScreenCTM());
                const contains = (outer, inner, epsilon = 0.5) =>
                    outer.left - epsilon <= inner.left &&
                    outer.right + epsilon >= inner.right &&
                    outer.top - epsilon <= inner.top &&
                    outer.bottom + epsilon >= inner.bottom;
                const touches = (path, shape) => {
                    if (!path || !shape) return false;
                    const { x, y } = point(path);
                    const box = shape.getBoundingClientRect();
                    return (
                        contains(box, { left: x, right: x, top: y, bottom: y }, 1) &&
                        Math.min(
                            Math.abs(x - box.left),
                            Math.abs(x - box.right),
                            Math.abs(y - box.top),
                            Math.abs(y - box.bottom),
                        ) <= 1
                    );
                };

                const ancestor = [
                    ["outer", "b", ["a", "c", "d"], "enter through both groups"],
                    ["c", "outer", ["a", "b", "d"], "leave through both groups"],
                ].map(([from, to, obstacles, label]) => {
                    const group = edge(from, to);
                    const line = group?.querySelector("path");
                    const arrow = group?.querySelector(".pele-marker");
                    const text = reader.querySelector(`.pele-edge-label[data-id="L_${from}_${to}_0"] text`);
                    if (!line || !arrow || !text || !shape("outer")) return { from, to, missing: true };
                    const blocked = obstacles.map((id) => shape(id)?.getBoundingClientRect());
                    const length = line.getTotalLength();
                    let clear = blocked.every(Boolean) && length > 0;
                    for (let distance = 0; clear && distance <= length; distance += 1) {
                        const { x, y } = point(line, distance);
                        clear = !blocked.some((box) => x > box.left && x < box.right && y > box.top && y < box.bottom);
                    }
                    return {
                        from,
                        to,
                        start: touches(line, shape(from)),
                        end: touches(arrow, shape(to)),
                        clear,
                        label:
                            text.textContent === label &&
                            contains(shape("outer").getBoundingClientRect(), text.getBoundingClientRect()),
                    };
                });

                const diamond = shape("Ready");
                const loop = edge("Ready", "Ready");
                const diamondEnds = ["path", ".pele-marker"].map((selector) => {
                    const path = loop?.querySelector(selector);
                    if (!diamond || !path) return false;
                    const { x, y } = point(path).matrixTransform(diamond.getScreenCTM().inverse());
                    return (
                        diamond.isPointInFill(new DOMPoint(x, y - 0.5)) &&
                        !diamond.isPointInFill(new DOMPoint(x, y + 0.5))
                    );
                });

                const polling = shape("polling");
                const svg = polling?.ownerSVGElement;
                const labels = [...(svg?.querySelectorAll(".pele-edge-label") ?? [])];
                const labelText = labels.map((label) => label.textContent);
                const expected = ["Poll again", "Retry after the response times out", "切换到备用服务后重新检查"];
                const boxes = labels.map((label) => label.getBoundingClientRect());
                const inside = boxes.every(
                    (box) =>
                        box.width > 0 &&
                        box.height > 0 &&
                        contains(svg.getBoundingClientRect(), box) &&
                        contains(polling.getBoundingClientRect(), box),
                );
                const overlaps = boxes.reduce(
                    (total, a, i) =>
                        total +
                        boxes
                            .slice(i + 1)
                            .filter(
                                (b) =>
                                    Math.min(a.right, b.right) > Math.max(a.left, b.left) &&
                                    Math.min(a.bottom, b.bottom) > Math.max(a.top, b.top),
                            ).length,
                    0,
                );

                const sources = [...reader.querySelectorAll(":scope > pre code.language-mermaid")];
                const source = sources[0]?.textContent.trim();
                const groupLoop = Boolean(edge("outer", "outer"));
                return [
                    {
                        pass: ancestor.every(({ start, end, clear, label }) => start && end && clear && label),
                        ancestor,
                    },
                    { pass: diamondEnds.every(Boolean), diamondEnds },
                    {
                        pass: inside && overlaps === 0 && JSON.stringify(labelText) === JSON.stringify(expected),
                        inside,
                        overlaps,
                        labelText,
                    },
                    {
                        pass:
                            !groupLoop &&
                            sources.length === 1 &&
                            source ===
                                "flowchart TD\nouter --> outer\nsubgraph outer[Outer]\na[A]\nsubgraph inner[Inner]\nb[B]\nend\nend",
                        groupLoop,
                        source,
                    },
                ];
            });
            for (const check of checks) {
                const label = options.expectedResults[results.length + failures.length];
                if (!check.pass) failures.push(`${label}: ${JSON.stringify(check)}`);
                else results.push(label);
            }
        } finally {
            await context.close();
        }
    }
    if (failures.length) throw new Error(failures.join("\n"));
    return { status: "FORMA_MARKDOWN_BROWSER_PASSED", results, sourceCases: {} };
}
